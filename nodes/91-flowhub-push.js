module.exports = function(RED) {
  function FlowHubPushFunctionality(config) {
    RED.nodes.createNode(this,config);

    var node = this;
    var cfg = config;

    node.on('close', function() {
      node.status({});
    });

    node.on("input", function(msg, send, done) {
      const os = require('os');
      const got = require('got');

      RED.util.evaluateNodeProperty(cfg.apiToken, cfg.apiTokenType,
                                    node, msg, (err, result) => {
        if (err) {
          node.status({fill:"red",shape:"dot",text:"Failed"});
          node.error(err)
        } else {
          var access_token = result;

          got.post( "https://api.flowhub.org/v1/flows", {
            headers: {
              "FlowHub-API-Version": "brownbear",
              "Authorization": "Bearer " + access_token,
            },
            json: {
              flowid: msg.flowid,
              flowdata: msg.flowdata,
              flowlabel: msg.flowlabel,
            },
            timeout: {
		          request: 10000,
		          response: 10000
	          }
          }).then( resp => {

            try {
              var rst = JSON.parse( resp.body )
            } catch (err) {
              node.status({fill:"red",shape:"dot",text:"Failed"});
              node.error(err)
              return
            }

            node.status({
              fill: rst.status == "nochange" ? "yellow" : "green",
              shape:"dot",
              text: rst.msg
            });
            setTimeout( function() { node.status({}) }, 1450);

            send({
              ...msg,
              payload: rst
            });

          }).catch( err => {
            node.status({fill:"red",shape:"dot",text:"Failed"});
            node.error(err)
          });
        }
      });
    });
  }

  RED.nodes.registerType("FlowHubPush", FlowHubPushFunctionality);

  RED.httpAdmin.post("/flowhub/:id",
                     RED.auth.needsPermission("flowhub.write"),
                     (req,res) => {
                       var node = RED.nodes.getNode(req.params.id);
                       if (node != null) {
                         try {
                           if (req.body && req.body.flowhub) {
                             node.receive(req.body);
                           } else {
                             node.receive();
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
