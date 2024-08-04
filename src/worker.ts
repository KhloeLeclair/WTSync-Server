import { DBFormatV1, Env, PlayerAndPluginFormatV1 } from "./types";
import { beginPartyRequest, databaseToPlugin, pluginToDatabase, writeError, writeJSON, writeSuccess } from "./utils";


export function fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {

	const url = new URL(request.url);

	if (url.pathname === '/submit')
		return handleSubmit(request, env, ctx);

	else if (url.pathname.startsWith('/party/'))
		return handleParty(request, env, ctx);

	else if (url.pathname.startsWith('/status'))
		return handleStatus(request, env, ctx);

	else if (url.pathname === '/')
		return writeSuccess('Hello world.');

	return writeError(404, 'Not Found');

}


export async function handleStatus(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const id = env.WEBSOCKET_HOST.idFromName('main'),
		stub = env.WEBSOCKET_HOST.get(id);

	const connections = stub ? (await stub.getConnectionCount()) : 0;

	return writeSuccess('Hello.', {
		connections
	});
}


export async function handleSubmit(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const body = await request.json() as PlayerAndPluginFormatV1;

	let thing: DBFormatV1 | null;

	// 1. Validation and conversion.
	try {
		if (typeof body?.id !== 'string' || body.id.length === 0)
			throw new Error('invalid player id');

		// If there is no status, we do a delete rather than an upsert.
		if (!body.status)
			thing = null;
		else
			thing = pluginToDatabase(body.id, body.status);

	} catch(err) {
		return writeError(400, `Invalid input: ${err}`);
	}


	// 2. Check the existing database record to see if this really is an update
	// or if the client is merely being safe and making extra requests.

	// While this does cause an extra D1 hit, this potentially bypasses a
	// call to the durable object so I consider it worth while.
	const existing = await env.DB.prepare('SELECT * FROM Entries WHERE player_id = ?')
		.bind(body.id)
		.run(),

		record = existing.success &&
			(existing as any)?.results?.[0] as DBFormatV1 | null;

	// Okay, we got a record, maybe. Does it match?
	const is_match = (record == null && thing == null) || (
		record != null && thing != null &&
		record.player_id === thing.player_id &&
		record.expires === thing.expires &&
		record.data === thing.data
		);

	if (is_match)
		return writeSuccess(`Data did not change.`);


	// 3. The record did change, so time to write it to the database.
	let response: D1Response;

	if ( thing )
		response = await env.DB.prepare('INSERT OR REPLACE INTO Entries (player_id, expires, data) VALUES (?1, ?2, ?3)')
			.bind(thing.player_id, thing.expires, thing.data)
			.run();
	else
		response = await env.DB.prepare('DELETE FROM Entries WHERE player_id = ?')
			.bind(body.id)
			.run();

	// If there was a database error, just quit now.
	if ( ! response.success )
		return writeError(500, 'database error');


	// 4. Send an event to the durable object to allow clients to auto-update.

	// TODO: Potentially check KV to see if we expect to have listeners.

	const id = env.WEBSOCKET_HOST.idFromName('main'),
		stub = env.WEBSOCKET_HOST.get(id);

	if (stub)
		ctx.waitUntil(stub.sendUpdate(thing
			? databaseToPlugin(thing)
			: {
				id: body.id,
				status: null
			}
		));


	// 5. Return a success.
	return writeSuccess(`Updated record in ${response.meta.duration}ms`);

}


export async function handleParty(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {

	// 1. Check if this is a WebSocket and should be upgraded.
	const upgradeHeader = request.headers.get('Upgrade');
	if (upgradeHeader === 'websocket') {
		let id = env.WEBSOCKET_HOST.idFromName('main');
		let stub = env.WEBSOCKET_HOST.get(id);

		return stub.fetch(request);
	}

	// If we got here, it's not a websocket. Do it normally.
	let results: PlayerAndPluginFormatV1[] | null;

	try {
		const resp = await beginPartyRequest(request, env);
		results = resp.results;

	} catch(err) {
		return writeError(400, (err as Error).message);
	}

	return writeSuccess(`Found ${results.length} entries.`, {
		results
	});

}
