module.exports = function (RED) {
  function FlowHubPullFunctionality(config) {
    RED.nodes.createNode(this, config);

    var node = this;
    var cfg = config;
    
    let hostForToken = (token) => {
      if (token && token.startsWith("local://")) {
        return token.replace(/local:\/\//,"").split("?")[0]
      } else {
        return "https://api.flowhub.org"
      }
    }

    let obtainFlow = (msg,token) => {
      if (cfg.flowid || msg.flowid) {
        import('got').then((module) => {
          module.got.get(
            `${hostForToken(token)}/v3/flows/` + (cfg.flowid || msg.flowid).trim() +
            "?cb=" + new Date().getTime() + "&v=" + (cfg.flowrevision || msg.flowrevision || "").trim(),
            {
              headers: {
                "FlowHub-API-Version": "brownbear",
                "X-FHB-TOKEN": token,
                "User-Agent": "FlowHub.org Pull Node Msg"
              },
              https: {
                rejectUnauthorized: false
              },
              timeout: {
                request: 25000,
                response: 25000
              }
          }).then(resp => {

              try {
                var payload = JSON.parse(resp.body)
                
                if (!payload.flowdata || !payload.nodedetails) {
                  node.status({ fill: "red", shape: "dot", text: `access denied, for token ${(token || "").substr(0,30)}` });
                  return node.error(`access denied for token '${token}'`)
                }

                node.send([
                  {
                    ...msg,
                    payload: JSON.parse(payload.nodedetails),
                    topic: "packages"
                  },
                  {
                   ...msg,
                    payload: JSON.parse(payload.flowdata),
                    topic: "flowjson"
                  }
                ]);

              } catch (err) {
                node.status({ fill: "red", shape: "dot", text: "Response Failed" });
                setTimeout(() => { node.status({}); }, 2500)
                return node.error(err)
              }

            }).catch(err => {
              node.status({ fill: "red", shape: "dot", text: "Failed" });
              setTimeout(() => { node.status({}); }, 2500)
              node.error(err)
            });
        });
      } else {
        node.status({ fill: "yellow", shape: "dot", text: "No FlowId defined" });
        setTimeout(() => { node.status({}); }, 2500)
      }
    }

    node.on('close', function () {
      node.status({});
    });

    node.on("input", function (msg, send, done) {
      let cfgNodes = []

      RED.nodes.eachNode(nde => {
        if (nde.type == "FlowHubCfg") {
          cfgNodes.push(nde)
        }
      })
            
      if ( cfgNodes.length > 0 ) {
        let creds = RED.nodes.getCredentials(cfgNodes[0].id)
        if (creds && creds.apiToken) {
          obtainFlow(msg, creds.apiToken)
        } else {
          obtainFlow(msg, "")

        }
      } else {
        obtainFlow(msg,"")
      }
    });
  }

  RED.nodes.registerType("FlowHubPull", FlowHubPullFunctionality);
}
