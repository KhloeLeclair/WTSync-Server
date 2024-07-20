import { DurableObject } from "cloudflare:workers";
import { Env } from "./types";
import { PlayerAndPluginFormatV1 } from "./types";
import { beginPartyRequest, writeError } from "./utils";


export class WebSocketHostObject extends DurableObject<Env> {

	getConnectionCount() {
		return this.ctx.getWebSockets().length;
	}

	sendUpdate(data: PlayerAndPluginFormatV1) {
		const sockets = this.ctx.getWebSockets(data.id),
			payload = JSON.stringify({
				msg: 'update',
				data
			});

		if ( Array.isArray(sockets) )
			for(const socket of sockets) {
				socket.send(payload);
			}
	}

	async fetch(request: Request): Promise<Response> {

		// Before agreeing to the websocket, handle the IDs.
		let ids: string[];
		let results: PlayerAndPluginFormatV1[];

		try {
			const resp = await beginPartyRequest(request, this.env);
			results = resp.results;
			ids = resp.ids;

		} catch(err) {
			return writeError(400, (err as Error).message);
		}

		// Create two ends of a WebSocket connection.
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		this.ctx.acceptWebSocket(
			server,
			ids
		);

		const connections = this.ctx.getWebSockets().length;

		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(
			'{"msg":"get_status"}',
			JSON.stringify({
				msg: 'status',
				connections
			})
		));

		// Send the initial data.
		server.send(JSON.stringify({msg: 'initial', results}));

		return new Response(null, {
			status: 101,
			webSocket: client
		});
	}

	webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void> {
		// do nothing
	}

	webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void> {
		const connections = this.ctx.getWebSockets().length - 1;

		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(
			'{"msg":"get_status"}',
			JSON.stringify({
				msg: 'status',
				connections
			})
		));
	}

}
