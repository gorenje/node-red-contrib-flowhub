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

  function submitWithEmail(cfgnode,msg) {
    respond("submission with email no longer supported.", "error", {})
  }

  function submitWithToken(access_token, cfgnode, msg) {

    import('got').then((module) => {
      module.got.post("https://api.flowhub.org/v1/flows", {
        headers: {
          "FlowHub-API-Version": "brownbear",
          "Authorization": "Bearer " + access_token,
        },
        json: {
          flowid:       msg.flowid,
          flowdata:     msg.flowdata,
          flowlabel:    msg.flowlabel,
          svgdata:      msg.svgdata,
          nodedetails:  msg.nodedetails,
          flowrevision: (cfgnode.flowrevisions || {})[msg.flowid] || "",
          pushcomment:  cfgnode.pushcomment,
          pushnewflows: cfgnode.pushnewflows,
          forcepush:    cfgnode.forcepush,
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

        let respObj = {
          flowid: rst.flowid,
          flowrevision: rst.revision
        }

        if ( rst.status == "nochange") {
          respond("submission succeed but no change.", "warning", respObj)
        } else if (rst.status == "failed") {
          respond("submission failed: " + rst.msg, "error", respObj)
        } else if (rst.status == "ok" ) {
          respond("submission succeed.", "success", respObj)
        } else {
          respond("submission failed.", "error", respObj)
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
                  respond("Push failed, no token provided. <a target=_blank href='https://flowhub.org/integration'>Get your token <i class='fa fa-external-link'></i></a>.", "error", msg)
                  return;
                } else {
                  submitWithEmail(cfgnode,msg)
                }
              } else {
                submitWithToken(result, cfgnode, msg)
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

  RED.httpAdmin.post("/FlowHubCatalogue",
    RED.auth.needsPermission("flowhub.write"),
    (req, res) => {
      try {
        if (req.body) {
          var msg = req.body;
          import('got').then((module) => {
            module.got.get("https://api.flowhub.org/v1/flows?cb=" + new Date().getTime(), {
              headers: {
                "X-FHB-TOKEN": msg.token
              },
              timeout: {
                request: 25000,
                response: 25000
              }
            }).then( resp => {
              try {
                res.status(200).send(JSON.parse(resp.body));
              } catch (err) {
                res.sendStatus(500);
              }
            }).catch( err => {
              console.error(err)
              res.sendStatus(500);
            })
          }).catch(err => { res.sendStatus(500); });            
        } else {
          res.sendStatus(405);
        }
      } catch (ex) {
        res.sendStatus(500);
      }
  });

  RED.httpAdmin.get('/FlowHubLib/jslib/:libraryname', function (req, res) {
    let redirectLocation = {}
    const path = require('path');
    const fs = require('fs')

    try {
      switch (req.params.libraryname) {
      case "diff.min.js":
        redirectLocation = { Location: 'https://cdn.openmindmap.org/thirdparty/diff.min.js' }
        let filename = path.resolve(path.dirname(__filename), "..", "vendor", "diff.min.js")

        if ( fs.existsSync( filename )) {
          return res.sendFile(filename)
        }
      }
    } catch (ex) {}

    res.writeHead(302, redirectLocation )
    return res.end();
  });

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