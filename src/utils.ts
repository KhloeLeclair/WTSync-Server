import { DBFormatV1, Env, PlayerAndPluginFormatV1, PluginFormatV1 } from './types';

export function pluginToDatabase(player: string, input: PluginFormatV1): DBFormatV1 {

	if (typeof input.expires !== 'string' || ! input.expires.length )
		throw new Error('invalid expires');

	const when = new Date(input.expires).getTime();

	if (when < Date.now())
		throw new Error('expired book');

	let stickers = parseInt(input.stickers, 10);
	if (Number.isNaN(stickers) || stickers < 0 || stickers > 9)
		throw new Error('input out of range');

	let points = parseInt(input.secondChancePoints, 10);
	if (Number.isNaN(points) || points < 0 || points > 9)
		throw new Error('input out of range');

	if (!Array.isArray(input.duties) || input.duties?.length !== 16)
		throw new Error('incorrect duties array');

	for(const entry of input.duties) {
		if (! entry?.id || entry.status == null || Object.keys(entry).length > 2 )
			throw new Error('incomplete duty entry');
	}

	return {
		player_id: player,
		expires: Math.floor(when / 1000), // we don't need milliseconds
		data: JSON.stringify({
			expires: input.expires,
			stickers: input.stickers,
			secondChancePoints: input.secondChancePoints,
			duties: input.duties
		})
	};
}

export function databaseToPlugin(input: DBFormatV1): PlayerAndPluginFormatV1 {

	return {
		id: input.player_id,
		status: JSON.parse(input.data)
	};

}


export function writeError(status: number, msg: string): Response {
	return writeJSON({
		ok: false,
		status: status,
		message: msg
	}, status);
}


export function writeSuccess(msg: string, obj?: any): Response {
	return writeJSON({
		...obj,
		ok: true,
		status: 200,
		message: msg
	}, 200);
}


export function writeJSON(obj: any, status = 200, headers?: Record<string, string>): Response {
	headers ??= {};

	if ( !headers['Content-Type'])
		headers['Content-Type'] = 'application/json;charset=utf-8';

	return new Response(JSON.stringify(obj), {
		status,
		headers
	});
}


export async function beginPartyRequest(request: Request, env: Env) {

	let ids: string[];

	// 1. Validation
	const url = new URL(request.url),
		match = /^\/party\/([\d,]+)$/i.exec(url.pathname);
	if (!match)
		throw new Error('invalid ids');

	ids = match[1].split(/,+/g);

	if (ids.length == 0 || ids.length > 8)
		throw new Error('wrong number of ids');

	// 2. Database interaction.
	const params = ids.map((_, i) => `?${i+1}`).join(',');

	const response = await env.DB.prepare(`SELECT * FROM Entries WHERE player_id IN (${params})`)
		.bind(...ids)
		.run();

	// If there was a database error, just quit now.
	if ( ! response.success )
		throw new Error('invalid response from database');

	// 3. Convert the output to the correct format.
	const results = [] as PlayerAndPluginFormatV1[];
	for(const entry of (response as any).results)
		results.push(databaseToPlugin(entry));

	return {
		ids,
		results
	};

}
