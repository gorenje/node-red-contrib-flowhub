module.exports = function(RED) {
  function FlowHubPullFunctionality(config) {
    RED.nodes.createNode(this,config);

    var node = this;
    var cfg = config;

    node.on('close', function() {
      node.status({});
    });

    node.on("input", function(msg, send, done) {
      if ( cfg.flowid || msg.flowid ) {

        import('got').then( (module) => {
          module.got.get( "https://api.flowhub.org/v1/flows/" + (
            cfg.flowid || msg.flowid
          ) + "?cb=" + new Date().getTime() + "&v=" + (
            cfg.flowrevision || msg.flowrevision
          ), 
          {
            headers: {
              "FlowHub-API-Version": "brownbear",
            },
            timeout: {
              request: 25000,
              response: 25000
            }
          }).then( resp => {

            try {
              var payload = JSON.parse( resp.body )

              if ( cfg.notab ) {
                payload = payload.filter( (nde) => {
                  return nde.type != "tab";
                })
              }

              node.send({
                ...msg,
                payload: payload
              });
            } catch (err) {
              node.status({fill:"red",shape:"dot",text:"Response Failed"});
              setTimeout( () => { node.status({}); }, 2500)
              node.error({...msg, error: err})
              return
            }

          }).catch( err => {
            node.status({fill:"red",shape:"dot",text:"Failed"});
            setTimeout( () => { node.status({}); }, 2500)
            node.error({...msg, error: err})
          });
        });
      } else {
        node.status({fill:"yellow",shape:"dot",text:"No FlowId defined"});
        setTimeout( () => { node.status({}); }, 2500)
      }
    });
  }

  RED.nodes.registerType("FlowHubPull", FlowHubPullFunctionality);
}
