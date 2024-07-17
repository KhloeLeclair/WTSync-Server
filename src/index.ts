import { fetch } from './worker';
import { scheduled } from './cron';
export { WebSocketHostObject } from './websocket-host';

export default {
	fetch,
	scheduled
};


/*
import { DBFormatV1, PlayerAndPluginFormatV1 } from './types';
import { databaseToPlugin, pluginToDatabase } from './utils';

type Bindings = {
	DB: D1Database;
	OBJ: DurableObjectNamespace;
};





const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async ctx => {
	return ctx.json({"hello": "world"});
});

app.post('/submit', async ctx => {
	const body = await ctx.req.json();
	console.log('input', body);

	if (!body || !body.id)
		return ctx.json({ok: false, status: 400, message: "Invalid input oh no"}, 400);

	let thing: DBFormatV1 | null;

	try {
		if (typeof body?.id !== 'string' || ! /^\d+/.test(body.id))
			throw new Error('invalid player id');

		// TODO: Allow no status to remove data.
		if (!body.status)
			thing = null;
		else
			thing = pluginToDatabase(body.id, body.status);

	} catch(err) {
		console.log(err);
		return ctx.json({ok: false, status: 400, message: `Invalid input: {err}`}, 400);
	}

	let response: D1Response;
	if ( thing )
		response = await ctx.env.DB.prepare('INSERT OR REPLACE INTO Entries (player_id, expires, data) VALUES (?1, ?2, ?3)')
			.bind(thing.player_id, thing.expires, thing.data)
			.run();
	else
		response = await ctx.env.DB.prepare('DELETE FROM Entries WHERE player_id = ?1')
			.bind(body.id)
			.run();

	if (!response.success)
		return ctx.json({
			ok: false,
			status: 500,
			message: 'Database error'
		}, 500);



	// TODO: Send an event to a durable object to allow clients to auto-refresh.

	return ctx.json({
		ok: true,
		status: 200,
		message: `Updated ${response.meta.rows_written} in ${response.meta.duration}ms`
	});

});

app.get('/party/:ids', async ctx => {

	let ids: string[];

	try {
		ids = ctx.req.param().ids
			.split(/\s*,\s* /g);

		if (ids.length == 0 || ids.length > 8)
			throw new Error('wrong number of IDs');

	} catch(err) {
		return ctx.json({
			ok: false,
			status: 400,
			message: 'invalid IDs'
		}, 400);
	}

	while(ids.length < 8)
		ids.push("NULL");

	const response = await ctx.env.DB.prepare('SELECT * FROM Entries WHERE player_id IN (?1,?2,?3,?4,?5,?6,?7,?8)')
		.bind(...ids)
		.run();

	if (!response.success)
		return ctx.json({
			ok: false,
			status: 500,
			message: 'database error'
		}, 500);

	const results = [] as PlayerAndPluginFormatV1[];

	for(const entry of (response as any).results) {
		results.push(databaseToPlugin(entry));
	}

	return ctx.json({
		ok: true,
		status: 200,
		results
	});

});






export default {

	fetch: app.fetch,

};
*/
