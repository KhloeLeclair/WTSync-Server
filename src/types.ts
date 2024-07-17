import { WebSocketHostObject } from "./websocket-host";

export interface Env {
	DB: D1Database;
	WEBSOCKET_HOST: DurableObjectNamespace<WebSocketHostObject>;
}


export type ZeroToNine = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type ZeroToNineString = `${ZeroToNine}`;

export type PlayerAndPluginFormatV1 = {
	id: string;
	status: PluginFormatV1 | null;
}

export type PluginFormatV1 = {
	expires: string;
	stickers: ZeroToNineString;
	secondChancePoints: ZeroToNineString;
	duties: PluginDutyStatus[];
};

export type PluginDutyStatus = {
	id: ZeroToNineString;
	status: `${DutyState}`;
};

export enum DutyState {
	Open,
	Claimable,
	Claimed
};


export type DBFormatV1 = {
	player_id: string;
	expires: number;

	data: string;
};
