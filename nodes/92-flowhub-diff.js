module.exports = function (RED) {
  function FlowHubDiffFunctionality(config) {
    RED.nodes.createNode(this, config);

    var node = this;
    var cfg = config;

    node.on('close', function () {
      node.status({});
    });

    node.on("input", function (msg, send, done) {
    });
  }
  
  RED.nodes.registerType("FlowHubDiff", FlowHubDiffFunctionality);

  RED.httpAdmin.post("/FlowHubDiff/:id",
    RED.auth.needsPermission("flowhub.write"),
    (req, res) => {
      var node = RED.nodes.getNode(req.params.id);
      if (node != null) {
        try {
          if (req.body && req.body.flowhub && req.params.id) {
            var nde = RED.nodes.getNode(req.params.id)

            if (nde && nde.type == "FlowHubDiff") {
              var msg = req.body;
              
              var flowdata = msg.flowdata.filter(function (obj) {
                return ((obj.type != "FlowHubPull" || (obj.type == "FlowHubPull" && msg.incflowhubpull)) && obj.type != "FlowHubPush" && obj.type != "FlowHubDiff")
              });


              import('got').then((module) => {
                module.got.post("https://api.flowhub.org/v1/diff", {
                  headers: {
                    "FlowHub-API-Version": "brownbear",
                  },
                  json: {
                    flowid: msg.flowid,
                    flowdata: flowdata,
                    flowlabel: msg.flowlabel,
                  },
                  timeout: {
                    request: 25000,
                    response: 25000
                  }
                }).then(resp => {
                  try {
                    var rst = JSON.parse(resp.body)
                    res.status(200).send(rst);
                  } catch (err) {
                    node.status({ fill: "red", shape: "dot", text: "Response Failed" });
                    node.error({ ...msg, error: err })
                    res.sendStatus(500);
                    return
                  }
                }).catch(err => {
                  if (err.toString().includes("Response code 405")) {
                    node.status({
                      fill: "yellow",
                      shape: "dot",
                      text: "Failed."
                    });
                  } else {
                    node.status({ fill: "red", shape: "dot", text: "Failed" });
                  }
                  res.sendStatus(500);
                });
              });
            }
          } else {
            res.sendStatus(404);
          }
        } catch (err) {
          res.sendStatus(500);
          node.error("FlowHub: Submission failed: " +
            err.toString())
        }
      } else {
        res.sendStatus(404);
      }
    });
}
