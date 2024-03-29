module.exports = function (RED) {
  function FlowHubPullFunctionality(config) {
    RED.nodes.createNode(this, config);

    var node = this;
    var cfg = config;

    let obtainFlow = (msg,token) => {
      if (cfg.flowid || msg.flowid) {
        import('got').then((module) => {
          module.got.get(
            "https://api.flowhub.org/v2/flows/" + (cfg.flowid || msg.flowid).trim() + 
            "?cb=" + new Date().getTime() + "&v=" + (cfg.flowrevision || msg.flowrevision || "").trim(),
          {
              headers: {
                "FlowHub-API-Version": "brownbear",
                "X-FHB-TOKEN": token
              },
              timeout: {
                request: 25000,
                response: 25000
              }
          }).then(resp => {

              try {
                var payload = JSON.parse(resp.body)

                if (!Array.isArray(payload)) {
                  node.status({ fill: "red", shape: "dot", text: "access denied" });
                  return node.error("access denied")
                }

                if (cfg.notab) {
                  payload = payload.filter((nde) => {
                    return nde.type != "tab";
                  })
                }

                /* collect the package details */
                let nodedetails = "[]"
                payload = payload.filter( nde => {
                  if ( nde.type == "__nodedetails__") {
                    nodedetails = nde.content
                    return false
                  } else {
                    return true
                  }                
                })

                node.send([
                  {
                    ...msg,
                    payload: JSON.parse(nodedetails)
                  },
                  {
                   ...msg,
                    payload: payload
                  }
                ]);

              } catch (err) {
                node.status({ fill: "red", shape: "dot", text: "Response Failed" });
                setTimeout(() => { node.status({}); }, 2500)
                node.error(err)
                return
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
        RED.util.evaluateNodeProperty(cfgNodes[0].apiToken, cfgNodes[0].apiTokenType, node, msg, (err, result) => {
          if ( !err ) {
            obtainFlow(msg, result)
          } else {
            obtainFlow(msg, "")
          }
        })
      } else {
        obtainFlow(msg,"")
      }
    });
  }

  RED.nodes.registerType("FlowHubPull", FlowHubPullFunctionality);
}
