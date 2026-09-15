module.exports = function (RED) {
  function ConfigFlowHubPushFunctionality(config) {
    RED.nodes.createNode(this, config)
  }
  
  RED.nodes.registerType('FlowHubCfg', ConfigFlowHubPushFunctionality, {
    credentials: {
      apiToken: { type: "text" },
      tokens: {}
    }
  });

  function respond(status, statustype, msg) {
    RED.comms.publish("flowhub:submission-result",
        RED.util.encodeObject({
            ...msg,
            status: status,
            statusType: statustype
        })
    );
}

function hostForToken(token) {
    if (token && token.startsWith("local://")) {
        return token.replace(/^local:\/\//, "").split("?")[0]
    } else {
        return "https://api.flowhub.org"
    }
}

function submitWithEmail(cfgnode, msg) {
    respond("submission with email no longer supported.", "error", {})
}

function submitWithToken(access_token, cfgnode, msg) {

    import('got').then((module) => {
        module.got.post(`${hostForToken(access_token)}/v1/flows`, {
            headers: {
                "FlowHub-API-Version": "brownbear",
                "Authorization": "Bearer " + access_token,
                "x-fhb-token": access_token
            },
            json: {
                flowid: msg.flowid,
                flowdata: msg.flowdata,
                flowlabel: msg.flowlabel,
                svgdata: msg.svgdata,
                nodedetails: msg.nodedetails,
                flowrevision: (cfgnode.flowrevisions || {})[msg.flowid] || "",
                pushcomment: cfgnode.pushcomment,
                pushnewflows: cfgnode.pushnewflows,
                forcepush: cfgnode.forcepush,
                commit_date: msg.commit_date
            },
            https: {
                rejectUnauthorized: false
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
                flowrevision: rst.revision,
                url: rst.url
            }

            if (rst.status == "nochange") {
                respond("submission succeed but no change.", "warning", respObj)
            } else if (rst.status == "failed") {
                respond("submission failed: " + rst.msg, "error", respObj)
            } else if (rst.status == "ok") {
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
    }).catch(err => {
        respond("submission failed, Internal Error: " + err, "error", {})
        console.error(err)
    })
}

//
///
/// API backend endpoints for the node package
///
//
RED.httpAdmin.post("/FlowHubDiff",
    RED.auth.needsPermission("flowhub.write"),
    (req, res) => {
        try {
            if (req.body && req.body.flowdata && req.body.flowid) {
                var msg = req.body;

                var cfgnode = req.body.cfgnode;
                var node = RED.nodes.getNode(cfgnode.id)
                var apiToken = cfgnode.apiToken

                if (!apiToken && node && node.credentials) {
                    apiToken = node.credentials.apiToken
                }

                let clientrevision = (cfgnode?.flowrevisions || {})[msg.flowid];

                import('got').then((module) => {
                    module.got.post(`${hostForToken(apiToken)}/v1/diff`, {
                        headers: {
                            "FlowHub-API-Version": "brownbear",
                            "X-FHB-TOKEN": apiToken
                        },
                        json: {
                            flowid: msg.flowid,
                            flowdata: msg.flowdata,
                            flowlabel: msg.flowlabel,
                            clientrev: clientrevision
                        },
                        https: {
                            rejectUnauthorized: false
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
            if (req.body) {
                var msg = req.body;
                var cfgnode = req.body.cfgnode;
                var node = RED.nodes.getNode(cfgnode.id)
                var apiToken = cfgnode.apiToken

                if (!apiToken && node && node.credentials) {
                    apiToken = node.credentials.apiToken
                }

                if (apiToken.trim() == "") {
                    res.sendStatus(200);
                    respond("Push failed, no token provided. <a target=_blank href='https://flowhub.org/integration'>Get your token <i class='fa fa-external-link'></i></a>.", "error", msg)
                    return;
                } else {
                    submitWithToken(apiToken, cfgnode, msg)
                }

                res.sendStatus(200);
            } else {
                res.sendStatus(405);
            }
        } catch (err) {
            console.error("ERROR", err)
            res.sendStatus(500);
        }
    }
);

RED.httpAdmin.post("/FlowHubCreateBranch",
    RED.auth.needsPermission("flowhub.write"),
    (req, res) => {
        if (req.body && req.body.token && req.body.branchname) {
            try {
                import('got').then((module) => {
                    module.got.post(`${hostForToken(req.body.token)}/v1/createbranch`, {
                        headers: {
                            "FlowHub-API-Version": "brownbear",
                            "X-FHB-TOKEN": req.body.token
                        },
                        json: {
                            branchname: req.body.branchname
                        },
                        https: {
                            rejectUnauthorized: false
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
            } catch (err) {
                console.error("ERROR", err)
                res.sendStatus(500);
            }
        } else {
            res.sendStatus(405);
        }
    }
);

RED.httpAdmin.post("/FlowHubPull",
    RED.auth.needsPermission("flowhub.read"),
    (req, res) => {
        if (req.body && req.body.flowid) {
            try {
                import('got').then((module) => {
                    module.got.get(`${hostForToken(req.body.token)}/v3/flows/${req.body.flowid}?cb=${new Date().getTime()}&v=${req.body.revision}`, {
                        headers: {
                            "FlowHub-API-Version": "brownbear",
                            "X-FHB-TOKEN": req.body.token
                        },
                        https: {
                            rejectUnauthorized: false
                        },
                        timeout: {
                            request: 25000,
                            response: 25000
                        }
                    }).then(resp => {
                        try {
                            res.status(200).send(JSON.parse(resp.body));
                        } catch (err) {
                            console.log(err)
                            res.sendStatus(500);
                        }
                    }).catch(err => { console.log(err) ; res.sendStatus(500); });
                }).catch(err => { console.log(err) ; res.sendStatus(500); });
            } catch (err) {
                console.error("ERROR", err)
                res.sendStatus(500);
            }
        } else {
            res.sendStatus(405);
        }
    }
);

RED.httpAdmin.post("/FlowHubToken",
    RED.auth.needsPermission("flowhub.write"),
    (req, res) => {
        try {
            if (req.body) {
                var cfgnode = req.body.cfgnode;
                var node = RED.nodes.getNode(cfgnode.id)

                var apiToken = cfgnode.apiToken

                if (!apiToken && node && node.credentials) {
                    apiToken = node.credentials.apiToken
                }

                if (apiToken == "empty") { apiToken = "" }

                if (apiToken.trim() == "") {
                    res.sendStatus(404);
                } else {
                    if (apiToken.startsWith("fhb_") || apiToken.startsWith("local://")) {
                        res.status(200).send({ token: apiToken });
                    } else {
                        res.sendStatus(404);
                    }
                }
            } else {
                res.sendStatus(405);
            }
        } catch (err) {
            res.sendStatus(500);
        }
    }
);

// complete list of stored tokens
RED.httpAdmin.post("/FlowHubTokens",
    RED.auth.needsPermission("flowhub.write"),
    (req, res) => {
        try {
            if (req.body) {
                var cfgnode = req.body.cfgnode;
                var node = RED.nodes.getNode(cfgnode.id)

                if (!node) {
                    node = {
                        credentials: {
                            tokens: [], apiToken: ""
                        }
                    }
                }

                res.status(200).send({ tokens: node.credentials.tokens, apiToken: node.credentials.apiToken });
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
                    module.got.get(`${hostForToken(msg.token)}/v1/flows?cb=` + new Date().getTime(), {
                        headers: {
                            "X-FHB-TOKEN": msg.token
                        },
                        https: {
                            rejectUnauthorized: false
                        },
                        timeout: {
                            request: 25000,
                            response: 25000
                        }
                    }).then(resp => {
                        try {
                            if (!resp.body) {
                                res.sendStatus(418)    
                            } else {
                                res.status(200).send(JSON.parse(resp.body));
                            }
                        } catch (err) {
                            res.sendStatus(500);
                        }
                    }).catch(err => {
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

RED.httpAdmin.get("/FlowHubDiffFrame/s/:flowid", function (req, res) {
    try {
        if (req.body) {
            let cfgNodes = []
            let apiToken = ""

            if (!req.query.t) {
                RED.nodes.eachNode(nde => {
                    if (nde.type == "FlowHubCfg") {
                        cfgNodes.push(nde)
                    }
                })

                if (cfgNodes.length > 0) {
                    let creds = RED.nodes.getCredentials(cfgNodes[0].id)
                    apiToken = creds ? creds.apiToken : ""
                }
            } else {
                apiToken = decodeURIComponent(req.query.t)
            }

            if (apiToken.trim() == "" || apiToken.startsWith("fhb_")) {
                res.sendStatus(404);
            } else {
                if (apiToken.startsWith("local://")) {
                    import('got').then((module) => {
                        module.got.get(`${hostForToken(apiToken)}/s/${req.params.flowid}?format=json&t=` + apiToken, {
                            headers: {
                                "X-FHB-TOKEN": apiToken
                            },
                            https: {
                                rejectUnauthorized: false
                            },
                            timeout: {
                                request: 25000,
                                response: 25000
                            }
                        }).then(resp => {
                            try {
                                res.status(200).send(resp.body);
                            } catch (err) {
                                console.log(err)
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
        } else {
            res.sendStatus(405);
        }
    } catch (err) {
        console.log(err)
        res.sendStatus(500);
    }

})

RED.httpAdmin.post("/FlowHubTokenCheck",
    RED.auth.needsPermission("flowhub.write"),
    (req, res) => {
        try {
            if (req.body) {
                var cfgnode = req.body.cfgnode;
                let apiToken = req.body.token;

                if (cfgnode) {
                    var node = RED.nodes.getNode(cfgnode.id)

                    if (node && node.credentials) {
                        apiToken = node.credentials.apiToken
                    }
                }

                if (apiToken.trim() == "") {
                    res.sendStatus(404);
                } else {
                    import('got').then((module) => {
                        module.got.get(`${hostForToken(apiToken)}/integration/token/check?format=json&t=${apiToken}`, {
                            headers: {
                            },
                            https: {
                                rejectUnauthorized: false
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
                }
            } else {
                res.sendStatus(405);
            }
        } catch (err) {
            res.sendStatus(500);
        }
    }
);

RED.httpAdmin.get('/FlowHubLib/jslib/:libraryname', function (req, res) {
    let redirectLocation = {}
    const path = require('path');
    const fs = require('fs')

    try {
        switch (req.params.libraryname) {
            case "diff.min.js":
                redirectLocation = { Location: 'https://cdn.openmindmap.org/thirdparty/diff.min.js' }
                let filename = path.resolve(path.dirname(__filename), "..", "vendor", "diff.min.js")

                if (fs.existsSync(filename)) {
                    return res.sendFile(filename)
                }
        }
    } catch (ex) { }

    res.writeHead(302, redirectLocation)
    return res.end();
});


}