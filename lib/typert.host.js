import { t as sessionAssistantRemoteDescriptors } from "./remote-contract-Dw_ohouN.js";
//#region lib/types/typert-host.js
const TYPERT = {
	package: "dsh-session-assistant",
	face: "host",
	schemas: [],
	invocations: sessionAssistantRemoteDescriptors(),
	model: {
		services: [{
			description: "Narrow revision-fenced Session Assistant settings Remote.",
			summary: "Narrow revision-fenced Session Assistant settings Remote.",
			tags: [],
			jsDoc: "/** Session Assistant settings Remote. */",
			key: "sessionAssistantSettings",
			exportName: "SessionAssistantSettingsRemote",
			members: [
				{
					kind: "method",
					name: "describe",
					signature: "@Remote('describe') describe(): Promise<SessionAssistantSettingsView>",
					summary: "Read settings."
				},
				{
					kind: "method",
					name: "save",
					signature: "@Remote('save') save(request: SaveSessionAssistantSettingsRequest): Promise<SessionAssistantSettingsView>",
					summary: "Save settings with revision fencing."
				},
				{
					kind: "method",
					name: "context",
					signature: "@Remote('context') context(request: SessionAssistantContextRequest): Promise<SessionAssistantContextView>",
					summary: "Project optional personal knowledge into the current assistant session."
				}
			],
			types: []
		}],
		events: [],
		objects: []
	}
};
//#endregion
export { TYPERT };
