module.exports = function (RED) {
  function ConfigFlowHubPushFunctionality(config) {
    RED.nodes.createNode(this, config)
  }
  
  RED.nodes.registerType('FlowHubPushCfg', ConfigFlowHubPushFunctionality);

  function respond(status, statustype, msg) {
    RED.comms.publish("flowhub:submission-result",
      RED.util.encodeObject({
        ...msg,
        status: status,
        statusType: statustype
      })
    );
  }

  function submitWithEmail(email, name, flowid, flowdata, flowlabel) {
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

  function submitWithToken(access_token, flowid, flowdata, flowlabel) {
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
        } else {
          respond("submission succeed.", "success", {})
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

  RED.httpAdmin.post("/FlowHubPush",
    RED.auth.needsPermission("flowhub.write"),
    (req, res) => {
        try {
          if (req.body ) {
            var msg = req.body;
            var cfgnode = req.body.cfgnode;
            var node = RED.nodes.getNode(cfgnode.id)

            var flowdata = msg.flowdata.filter(function (obj) {
              return ((obj.type != "FlowHubPull" || (obj.type == "FlowHubPull" && msg.incflowhubpull)) && obj.type != "FlowHubPush" && obj.type != "FlowHubDiff")
            });

            RED.util.evaluateNodeProperty(cfgnode.apiToken, cfgnode.apiTokenType, node, msg, (err, result) => {
              if (err || (result || "").trim() == "") {
                if ((cfgnode.fullname || "").trim() == "" || (cfgnode.email || "").trim() == "") {
                  res.sendStatus(200);
                  respond("Failed, no API TOKEN provided nor email and name.", "error", msg)
                  return;
                } else {
                  submitWithEmail(cfgnode.email, cfgnode.fullname, msg.flowid, flowdata, msg.flowlabel)
                }
              } else {
                submitWithToken(result, msg.flowid, flowdata, msg.flowlabel)
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

}