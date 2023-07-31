module.exports = function(RED) {
  function FlowHubPullFunctionality(config) {
    RED.nodes.createNode(this,config);

    var node = this;
    var cfg = config;

    node.on('close', function() {
      node.status({});
    });

    node.on("input", function(msg, send, done) {
    });
  };

  RED.nodes.registerType("FlowHubPull", FlowHubPullFunctionality);
}
