module.exports = function(RED) {
  function FlowHubPushFunctionality(config) {
    RED.nodes.createNode(this,config);

    var node = this;
    var cfg = config;

    node.on('close', function() {
      node.status({});
    });

    node.on("input", function(msg, send, done) {
      // remove flowhub nodes from the submission
      var flowdata = msg.flowdata.filter(function(obj) {
        return ( (obj.type != "FlowHubPull" || (obj.type == "FlowHubPull" && msg.incflowhubpull)) && obj.type != "FlowHubPush" && obj.type != "FlowHubDiff")
      });

      RED.util.evaluateNodeProperty(cfg.apiToken, cfg.apiTokenType,
                                    node, msg, (err, result) => {
        if (err || result.trim() == "") {
          if ( cfg.fullname.trim() == "" || cfg.email.trim() == "" ) {
            node.status({
              fill:"red",
              shape:"dot",
              text:"Failed, no API TOKEN provided nor email and name."
            });

            node.error({...msg, error: err})
            return;
          }

          /*
           * Email based submission.
           */
          import('got').then( (module) => {
            module.got.post( "https://api.flowhub.org/v1/flows", {
              headers: {
                "FlowHub-API-Version": "brownbear",
                "X-Name": cfg.fullname,
                "X-Email": cfg.email,
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
            }).then( resp => {

              try {
                var rst = JSON.parse( resp.body )
              } catch (err) {
                node.status({fill:"red",shape:"dot",text:"Response Failed"});
                node.error({...msg, error: err})
                return
              }

              node.status({
                fill: rst.status == "ok" ? "yellow" : "red",
                shape:"dot",
                text: rst.msg
              });

              setTimeout( function() {
                node.status({})
              }, 4500);

              send({
                ...msg,
                payload: flowdata,
                result: rst
              });

            }).catch( err => {
              if ( err.toString().includes("Response code 405") ) {
                node.status({
                  fill:"yellow",
                  shape:"dot",
                  text:"Email/Name not supplied or allowed."
                });
              } else {
                node.status({fill:"red",shape:"dot",text:"Failed"});
                node.error({...msg, error: err})
              }
            });
          });
        } else {
          /*
           * Access token submission.
           */
          var access_token = result;

          import('got').then( (module) => {
            module.got.post( "https://api.flowhub.org/v1/flows", {
              headers: {
                "FlowHub-API-Version": "brownbear",
                "Authorization": "Bearer " + access_token,
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
            }).then( resp => {

              try {
                var rst = JSON.parse( resp.body )
              } catch (err) {
                node.status({fill:"red",shape:"dot",text:"Response Failed"});
                node.error(err)
                return
              }

              node.status({
                fill: rst.status == "nochange" ? "yellow" : "green",
                shape:"dot",
                text: rst.msg
              });

              setTimeout( function() {
                node.status({
                  fill: "green",
                  shape:"dot",
                  text: rst.url
                })
              }, 1450);

              send({
                ...msg,
                payload: flowdata,
                result: rst
              });

            }).catch( err => {
              if ( err.toString().includes("Response code 405") ) {
                node.status({
                  fill:"yellow",
                  shape:"dot",
                  text:"API Token missing/incorrect"
                });
              } else {
                node.status({fill:"red",shape:"dot",text:"Failed"});
                node.error(err)
              }
            });
          });
        }
      });
    });
  }

  RED.nodes.registerType("FlowHubPush", FlowHubPushFunctionality);

  RED.httpAdmin.post("/FlowHubPush/:id",
                     RED.auth.needsPermission("flowhub.write"),
                     (req,res) => {
                       var node = RED.nodes.getNode(req.params.id);
                       if (node != null) {
                         try {
                           if (req.body && req.body.flowhub && req.params.id) {
                             var nde = RED.nodes.getNode(req.params.id)
                             if ( nde && nde.type == "FlowHubPush" ) {
                               node.receive(req.body);
                             }
                           } else {
                             res.sendStatus(404);
                           }
                           res.sendStatus(200);
                         } catch(err) {
                           res.sendStatus(500);
                           node.error("FlowHub: Submission failed: " +
                                      err.toString())
                         }
                       } else {
                         res.sendStatus(404);
                       }
                     });
}
