module.exports = function (RED) {
  function ConfigFlowHubDiffFunctionality(config) {
    RED.nodes.createNode(this, config)
  }
  
  RED.nodes.registerType('FlowHubDiffCfg', ConfigFlowHubDiffFunctionality);

  RED.httpAdmin.post("/FlowHubDiff",
    RED.auth.needsPermission("flowhub.write"),
    (req, res) => {
        try {
          if (req.body && req.body.flowdata && req.body.flowid) {
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
                  res.sendStatus(500);
                }
              }).catch(err => { res.sendStatus(500); });
            }).catch(err => { res.sendStatus(500); });
          } else {
            res.sendStatus(405);
          }
        } catch (err) {
          res.sendStatus(500);
        }
    });
}