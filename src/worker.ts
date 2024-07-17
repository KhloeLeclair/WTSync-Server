import { DBFormatV1, Env, PlayerAndPluginFormatV1 } from "./types";
import { beginPartyRequest, databaseToPlugin, pluginToDatabase, writeError, writeSuccess } from "./utils";


export function fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {

	const url = new URL(request.url);

	if (url.pathname === '/submit')
		return handleSubmit(request, env, ctx);

	else if (url.pathname.startsWith('/party/'))
		return handleParty(request, env, ctx);

	else if (url.pathname === '/')
		return writeSuccess('Hello world.');

	return writeError(404, 'Not Found');

}


export async function handleSubmit(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const body = await request.json() as PlayerAndPluginFormatV1;

	let thing: DBFormatV1 | null;

	// 1. Validation and conversion.
	try {
		if (typeof body?.id !== 'string' || ! /^\d+$/.test(body.id))
			throw new Error('invalid player id');

			// If there is no status, we do a delete rather than an upsert.
			if (!body.status)
				thing = null;
			else
				thing = pluginToDatabase(body.id, body.status);

	} catch(err) {
		return writeError(400, `Invalid input: ${err}`);
	}

	// 2. Database interaction.
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

	// 3. Send an event to the durable object to allow clients to auto-update.
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

	// 4. Return a success.
	return writeSuccess(`Updated ${response.meta.rows_written} in ${response.meta.duration}ms`);

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
