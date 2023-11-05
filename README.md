## FlowHub: Gist for Node-RED

**Work In Progress**

These are the Node-RED nodes that interact with [FlowHub.org](https://flowhub.org).

[FlowHub.org](https://FlowHub.org) is an experimental first attempt to provide a gist/pastebin-like service for Node-RED.

The aim is to make it easy to share flow-tabs amongst Node-RED developers.

Flows can be exported directly from the Node-RED editor to FlowHub.org. Flows that have been edited but not deployed can be exported. Flows are taken from the editor not the Node-RED server.

Flows can be imported into the Node-RED editor using the pull node. Flows can be imported into new tabs or directly into existing tabs.

## Node: FlowHub - Pull

Node for importing flows from FlowHub.org. Flows may be imported into an existing tab or a new tab. This can also be included in flows so that there is an chaining of flows. That is, if a flow relys on anther flow, then an pull node can be included to import that second flow.

## Sidebar: FlowHub - Push

Node for pushing in-editor flows to FlowHub.org. Flows do not need to be deployed to be exported.

By exporting any flows you accept the license as described below.

The entire flow-tab is exported to FlowHub.org, so beware what you export.

Pushing flows can now be done using your email and name, no API token is necessary. Be aware that email verification is necessary for **every** submission.

## Sidebar: FlowHub - Diff

Compare the local version of a flow with the latest version at FlowHub.org. 

Property panel for the diff node:

![img](https://cdn.openmindmap.org/content/1696512960899_Screen_Shot_2023-10-05_at_15.19.11.png)

## License

All flows found here are licensed under the [don't do evil license](https://cdn.openmindmap.org/LICENSE.txt).

**Usage of FlowHub.org implies adherence to that license.**.

## Artifacts

- [NPMjs Package](https://www.npmjs.com/package/@gregoriusrippenstein/node-red-contrib-flowhub)
- [Node-RED node package](https://flows.nodered.org/node/@gregoriusrippenstein/node-red-contrib-flowhub)
- [GitHub Repo](https://github.com/gorenje/node-red-contrib-flowhub)
- The flow that maintains this [codebase](https://flowhub.org/f/4a831589774ecb04).


