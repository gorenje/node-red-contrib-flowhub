module.exports = function (RED) {
  function ConfigFlowHubPushFunctionality(config) {
    RED.nodes.createNode(this, config)
  }
  
  RED.nodes.registerType('FlowHubCfg', ConfigFlowHubPushFunctionality);

  function respond(status, statustype, msg) {
    RED.comms.publish("flowhub:submission-result",
      RED.util.encodeObject({
        ...msg,
        status: status,
        statusType: statustype
      })
    );
  }

  function submitWithEmail(email, name, comment, flowid, flowdata, flowlabel, svgdata, nodedetails) {
    import('got').then((module) => {
      module.got.post("https://api.flowhub.org/v1/flows", {
        headers: {
          "FlowHub-API-Version": "brownbear",
          "X-Name": name,
          "X-Email": email,
        },
        json: {
          flowid: flowid,
          flowdata: flowdata,
          flowlabel: flowlabel,
          pushcomment: comment,
          svgdata: svgdata,
          nodedetails: nodedetails
        },
        timeout: {
          request: 25000,
          response: 25000
        }
      }).then(resp => {

        try {
          var rst = JSON.parse(resp.body)
        } catch (err) {
          respond("response failed", "error", {})
          return
        }

        if ( rst.status == "ok") {
          respond("submission succeed, please verify your email.", "success", {})
        } else {
          respond("submission failed: " + rst.msg, "error", { })
        }
      }).catch(err => {

        if (err.toString().includes("Response code 405")) {
          respond("submission failed, Email/Name not supplied or allowed.", "error", {})
        } else {
          respond("submission failed: " + err, "error", {})
          console.error(err)
        }
      });
    }).catch( err => { 
      respond("submission failed, Internal Error: " + err, "error", {})
      console.error(err)
    })
  }

  function submitWithToken(access_token, comment, flowid, flowdata, flowlabel, svgdata, nodedetails) {
    import('got').then((module) => {
      module.got.post("https://api.flowhub.org/v1/flows", {
        headers: {
          "FlowHub-API-Version": "brownbear",
          "Authorization": "Bearer " + access_token,
        },
        json: {
          flowid: flowid,
          flowdata: flowdata,
          flowlabel: flowlabel,
          pushcomment: comment,
          svgdata: svgdata,
          nodedetails: nodedetails
        },
        timeout: {
          request: 25000,
          response: 25000
        }
      }).then(resp => {

        try {
          var rst = JSON.parse(resp.body)
        } catch (err) {
          respond("response failed", "error", {})
          return
        }

        if ( rst.status == "nochange") {
          respond("submission succeed but no change.", "warning", {})
        } else if (rst.status == "failed") {
          respond("submission failed: " + rst.msg, "error", {})
        } else if (rst.status == "ok" ) {
          respond("submission succeed.", "success", {})
        } else {
          respond("submission failed.", "error", {})
        }
        
      }).catch(err => {
        if (err.toString().includes("Response code 405")) {
          respond("submission failed, API Token missing/incorrect.", "error", {})
        } else {
          respond("submission failed: " + err, "error", {})
          console.error(err)
        }
      });
    }).catch( err => { 
      respond("submission failed, Internal Error: " + err, "error", {})
      console.error(err)
    })
  }

  RED.httpAdmin.post("/FlowHubDiff",
    RED.auth.needsPermission("flowhub.write"),
    (req, res) => {
      try {
        if (req.body && req.body.flowdata && req.body.flowid) {
          var msg = req.body;

          var cfgnode = req.body.cfgnode;
          var node = RED.nodes.getNode(cfgnode.id)

          RED.util.evaluateNodeProperty(cfgnode.apiToken, cfgnode.apiTokenType, node, msg, (err, result) => {
            import('got').then((module) => {
              module.got.post("https://api.flowhub.org/v1/diff", {
                headers: {
                  "FlowHub-API-Version": "brownbear",
                  "X-FHB-TOKEN": result
                },
                json: {
                  flowid: msg.flowid,
                  flowdata: msg.flowdata,
                  flowlabel: msg.flowlabel,
                },
                timeout: {
                  request: 25000,
                  response: 25000
                }
              }).then(resp => {
                try {
                  res.status(200).send(JSON.parse(resp.body));
                } catch (err) {
                  res.sendStatus(500);
                }
              }).catch(err => { res.sendStatus(500); });
            }).catch(err => { res.sendStatus(500); });
          })
        } else {
          res.sendStatus(405);
        }
      } catch (err) {
        res.sendStatus(500);
      }
  });


  RED.httpAdmin.post("/FlowHubPush",
    RED.auth.needsPermission("flowhub.write"),
    (req, res) => {
        try {
          if (req.body ) {
            var msg = req.body;
            var cfgnode = req.body.cfgnode;
            var node = RED.nodes.getNode(cfgnode.id)

            RED.util.evaluateNodeProperty(cfgnode.apiToken, cfgnode.apiTokenType, node, msg, (err, result) => {
              if (err || (result || "").trim() == "") {
                if ((cfgnode.fullname || "").trim() == "" || (cfgnode.email || "").trim() == "") {
                  res.sendStatus(200);
                  respond("Failed, no API TOKEN provided nor email and name.", "error", msg)
                  return;
                } else {
                  submitWithEmail(cfgnode.email, cfgnode.fullname, cfgnode.pushcomment, 
                                  msg.flowid, msg.flowdata, msg.flowlabel, msg.svgdata, msg.nodedetails)
                }
              } else {
                submitWithToken(result, cfgnode.pushcomment, msg.flowid, msg.flowdata, 
                                msg.flowlabel, msg.svgdata, msg.nodedetails)
              }

              res.sendStatus(200);
            });
          } else {
            res.sendStatus(405);
          }
        } catch (err) {
          console.error( "ERROR", err)
          res.sendStatus(500);
        }
    }
  );

  RED.httpAdmin.post("/FlowHubToken",
    RED.auth.needsPermission("flowhub.write"),
    (req, res) => {
      try {
        if (req.body) {
          var msg = req.body;
          var cfgnode = req.body.cfgnode;
          var node = RED.nodes.getNode(cfgnode.id)

          RED.util.evaluateNodeProperty(cfgnode.apiToken, cfgnode.apiTokenType, node, msg, (err, result) => {
            if (err || (result || "").trim() == "") {
              res.sendStatus(404);
            } else {
              if ( result.startsWith("fhb_") ) {
                res.status(200).send({token: result});
              } else {
                res.sendStatus(404);
              }
            }
          });
        } else {
          res.sendStatus(405);
        }
      } catch (err) {
        res.sendStatus(500);
      }
    }
  );

  RED.httpAdmin.post("/FlowHubTokenCheck",
    RED.auth.needsPermission("flowhub.write"),
    (req, res) => {
      try {
        if (req.body) {
          var msg = req.body;
          var cfgnode = req.body.cfgnode;
          var node = RED.nodes.getNode(cfgnode.id)

          RED.util.evaluateNodeProperty(cfgnode.apiToken, cfgnode.apiTokenType, node, msg, (err, result) => {
            if (err || (result || "").trim() == "") {
              res.sendStatus(404);
            } else {
              if ( result.startsWith("fhb_") ) {
                import('got').then((module) => {
                  module.got.get("https://flowhub.org/integration/token/check?format=json&t=" + result, {
                    headers: {
                    },
                    timeout: {
                      request: 25000,
                      response: 25000
                    }
                  }).then(resp => {
                    try {
                      res.status(200).send(JSON.parse(resp.body));
                    } catch (err) {
                      res.sendStatus(500);
                    }
                  }).catch(err => { 
                    console.error(err)
                    res.sendStatus(500); 
                    });
                }).catch(err => { res.sendStatus(500); });
              } else {
                res.sendStatus(404);
              }
            }
          });
        } else {
          res.sendStatus(405);
        }
      } catch (err) {
        res.sendStatus(500);
      }
    }
  );

}