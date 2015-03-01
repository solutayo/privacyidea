/**
 * http://www.privacyidea.org
 * (c) cornelius kölbel, cornelius@privacyidea.org
 *
 * 2015-01-11 Cornelius Kölbel, <cornelius@privacyidea.org>
 *
 * This code is free software; you can redistribute it and/or
 * modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or any later version.
 *
 * This code is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU AFFERO GENERAL PUBLIC LICENSE for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
myApp.controller("policyListController", function($scope, $stateParams,
                                                    $location, ConfigFactory) {
    if ($location.path() == "/config/policies") {
        $location.path("/config/policies/list");
    }

    // Get all policies
    $scope.getPolicies = function () {
        ConfigFactory.getPolicies(function(data) {
            $scope.policies = data.result.value;
            console.log("Fetched all policies");
            console.log($scope.policies);
        });
    };

    $scope.delPolicy = function (policyName) {
        ConfigFactory.delPolicy(policyName, function(data) {
            $scope.getPolicies();
        });
    };

    $scope.getPolicies();
});

myApp.controller("policyDetailsController", function($scope, $stateParams,
                                                     ConfigFactory, $state) {
    // init
    $scope.realms = [];
    $scope.resolvers = [];
    $scope.realmsLoaded = false;
    $scope.resolversLoaded = false;
    $scope.scopes = [];

    // get init values from the server
    ConfigFactory.getRealms(function(data){
        var realms = data.result.value;
        angular.forEach(realms, function (value, key) {
            $scope.realms.push({name: key, ticked: false});
        });
        // after realms and resolvers have loaded, we can preset the policy values
        $scope.realmsLoaded = true;
        if ($scope.resolversLoaded) {
            $scope.presetEditValues();
        }
    });
    ConfigFactory.getResolvers(function(data) {
        var resolvers = data.result.value;
        angular.forEach(resolvers, function(value, key) {
            $scope.resolvers.push({name: key, ticked: false});
        });
        // after realms and resolvers have loaded, we can preset the policy values
        $scope.resolversLoaded = true;
        if ($scope.realmsLoaded) {
            $scope.presetEditValues();
        }
    });
    $scope.params = {
            action: "",
            scope: "",
            realm: "",
            resolver: "",
            user: "",
            active: true,
            client: ""
        };
    $scope.existingPolicyname = $stateParams.policyname;
    if ($scope.existingPolicyname) {
        $scope.policyname = $scope.existingPolicyname;
    }

    ConfigFactory.getPolicyDefs(function (data) {
        $scope.policyDefs = data.result.value;
        // fill the scope:
        angular.forEach($scope.policyDefs, function (value, key) {
            $scope.scopes.push({name: key, ticked: false})
        });
    });

    // define functions
    $scope.enablePolicy = function (name) {
        ConfigFactory.enablePolicy(name, function () {
            $scope.params.active = true;
            $scope.getPolicies();
        })
    };

    $scope.disablePolicy = function (name) {
        ConfigFactory.disablePolicy(name, function () {
            $scope.params.active = false;
            $scope.getPolicies();
        })
    };

    $scope.fillActionList = function (scope, policyActions) {
        // Each time the scope is changed, we need to fill the
        // action dropdown.
        // in the case of action values, we need to provide a list of
        // checkboxes and input fields.
        // we can do this with include files like at token.enroll
        console.log(scope);
        var actions = $scope.policyDefs[scope];
        console.log(actions);
        $scope.actions = [];
        $scope.isActionValues = false;

        angular.forEach(actions, function(value, key) {
            // TODO: we might evaluate value.group and group the actions
            //$scope.actions.push({name: "GroupName", multiSelectGroup: true})
            //$scope.actions.push({multiSelectGroup: false})
            // Check the given policy actions
            var ticked = false;
            if (policyActions && policyActions[key] == true) {
                ticked = true;
            }
            $scope.actions.push({name: key, help: value.desc, ticked: ticked});
            // Check if we need to do actionValues
            if (value.type != "bool") {
                $scope.isActionValues = true;
            }
        });

        if ($scope.isActionValues) {
            // This holds the array of actionValues
            $scope.actionValuesStr = {};
            $scope.actionValuesNum = {};
            $scope.actionCheckBox = {};
            $scope.actions = [];
            // This scope contains action values. We need to create
            // a list of checkboxes and input fields.
            angular.forEach(actions, function(value, key) {
                $scope.actions.push({name: key,
                                     type: value.type,
                                     desc: value.desc,
                                     allowedValues: value.value});
                // preset the fields
                if (policyActions && policyActions[key]) {
                    $scope.actionCheckBox[key] = true;
                    if (policyActions[key] !== true) {
                        if (value.type == "str")
                            $scope.actionValuesStr[key] = policyActions[key];
                        if (value.type == "int")
                            $scope.actionValuesNum[key] = parseInt(policyActions[key]);
                    }
                }
            });
        }
    };

    $scope.createPolicy = function () {
        // This is called to save the policy
        // get scope
        var scope = $scope.selectedScope[0].name;
        var realms = [];
        var resolvers = [];
        var actions = [];
        $scope.params.scope = scope;
        $scope.params.action = [];
        // get actions

        if ($scope.isActionValues) {
            // we need to process the value-actions
            // iterate through the checkboxes
            angular.forEach($scope.actionCheckBox, function(value, key){
                if (value) {
                    // The action is checked. So try to get an action value.
                    // either a string, a num or only a bool
                    var aval = $scope.actionValuesStr[key];
                    if (aval) {
                        $scope.params.action.push(key + "=" + aval);
                    } else {
                        aval = $scope.actionValuesNum[key];
                        if (aval === false || aval === undefined) {
                            // We must avoid getting here if aval==0
                            // it is a bool value
                            $scope.params.action.push(key);
                        } else {
                            $scope.params.action.push(key + "=" + aval);
                        }
                    }
                }
            });
        } else {
            // We only have boolean actions...
            angular.forEach($scope.selectedActions, function (value, key) {
                console.log(value);
                $scope.params.action.push(value.name);
            });
        }
        // get realms
        angular.forEach($scope.selectedRealms, function(value, key) {
            console.log(value);
            realms.push(value.name);
            $scope.params.realm = realms;
        });
        // get resolvers
        angular.forEach($scope.selectedResolvers, function(value, key) {
            console.log(value);
            resolvers.push(value.name);
            $scope.params.resolver = resolvers;
        });
        ConfigFactory.setPolicy($scope.policyname, $scope.params,
            function(data) {
                console.log(data);
                // Return to the policy list
                $scope.getPolicies();
                $state.go("config.policies.list");
            })
    };

    $scope.presetEditValues = function () {
        console.log("presetEditValues");
        console.log($scope.policies);

        presetEditValues2 = function(policy) {
            console.log(policy);
            // fill $scope.params
            $scope.params.user = policy.user;
            $scope.params.active = policy.active;
            $scope.params.client = policy.client;
            // tick the realms and the resolvers
            angular.forEach($scope.realms, function (value, key) {
                if (policy.realm.indexOf(value.name) > -1) {
                    $scope.realms[key].ticked = true;
                }
            });
            angular.forEach($scope.resolvers, function (value, key) {
                if (policy.resolver.indexOf(value.name) > -1) {
                    $scope.resolvers[key].ticked = true;
                }
            });
            angular.forEach($scope.scopes, function (value, key){
                if (policy.scope == value.name) {
                    $scope.scopes[key].ticked = true;
                } else {
                    $scope.scopes[key].ticked = false;
                }
            });
            $scope.fillActionList(policy.scope, policy.action);
        };

        if ($scope.policies) {
            // We have $scope.policies, since we come from the state policies.list
            angular.forEach($scope.policies, function (value, key){
               if (value.name == $stateParams.policyname) {
                    presetEditValues2(value);
               }
            });
        } else {
            // We have no $scope.policies, maybe since we are called directly.
            // So we need to fetch this policy definition
            ConfigFactory.getPolicy($stateParams.policyname, function (data) {
                var policy = data.result.value[0];
                presetEditValues2(policy);
            });
        }
    }

});

myApp.controller("tokenConfigController", function ($scope, $location,
                                                    $rootScope, $state,
                                                    $stateParams,
                                                    ConfigFactory, instanceUrl) {
    $scope.defaultSMSProvider = "privacyidea.lib.smsprovider.HttpSMSProvider.HttpSMSProvider";
    $scope.tokentype = $stateParams.tokentype || "hotp";
    $scope.form = {};
    $scope.original_params = {};
    $scope.instanceUrl = instanceUrl;
    $scope.formInit = {
        totpSteps: ["30", "60"],
        hashlibs: ["sha1", "sha256", "sha512"],
        smsProviders: [$scope.defaultSMSProvider,
        "privacyidea.lib.smsprovider.SipgateSMSProvider.SipgateSMSProvider",
        "privacyidea.lib.smsprovider.SmtpSMSProvider.SmtpSMSProvider"]
    };

    $scope.loadSystemConfig = function () {
        ConfigFactory.loadSystemConfig(function (data) {
            $scope.form = data.result.value;
            // make a deep copy
            angular.copy($scope.form, $scope.original_params);
            // TODO: We need to put these settings in the token specific code
            // Default inits
            $scope.form['totp.timeStep'] = $scope.form['totp.timeStep'] || "30";
            $scope.form['totp.hashlib'] = $scope.form['totp.hashlib'] || "sha1";
            $scope.form['hotp.hashlib'] = $scope.form['hotp.hashlib'] || "sha1";
            // RADIUS
            $scope.form['radius.secret.type'] = "password";
            $scope.form['radius.dictfile'] = "/etc/privacyidea/dictionary"
            // SMS
            $scope.form['sms.Provider'] = $scope.form['sms.Provider'] || $scope.defaultSMSProvider;
        });
    };

    $scope.saveTokenConfig = function () {
        // only save parameters, that have changed!
        var save_params = {};
        angular.forEach($scope.form, function (value, key) {
            if (value != $scope.original_params[key])
                save_params[key] = value;
        });
        ConfigFactory.saveSystemConfig(save_params, function (data) {
            // TODO: what should we do?
        });
    };

    $scope.loadSystemConfig();
});
myApp.controller("configController", function ($scope, $location,
                                               $rootScope, $state,
                                               ConfigFactory) {
    $scope.params = {};
    // go to the system view by default
    if ($location.path() == "/config") {
        $location.path("/config/system");
    }
    if ($location.path() == "/config/resolvers") {
        $location.path("/config/resolvers/list");
    }
    if ($location.path() == "/config/realms") {
        $location.path("/config/realms/list");
    }

    // TODO: This information needs to be fetched from the server
    $scope.availableResolverTypes = ['passwdresolver', 'ldapresolver', 'sqlresolver'];

    $scope.isChecked = function (val) {
        // check if val is set
        return [true, 1, '1', 'True'].indexOf(val) > -1
    };

    $scope.getResolvers = function () {
        ConfigFactory.getResolvers(function (data) {
            $scope.resolvers = data.result.value
        });
    };

    $scope.delResolver = function (name) {
        ConfigFactory.delResolver(name, function (data) {
            $scope.resolvers = data.result.value;
            $scope.getResolvers();
        });
    };

    $scope.getRealms = function () {
        ConfigFactory.getRealms(function (data) {
            $scope.realms = data.result.value;
        });
    };

    $scope.setRealm = function (name) {
        var resolvers = [];
        angular.forEach($scope.selectedResolvers, function (value, resolver) {
            if (value === true) {
                resolvers.push(resolver)
            }
        });

        var pObject = {resolvers: resolvers.join(',')};

        ConfigFactory.setRealm(name, pObject, function (data) {
            $scope.set_result = data.result.value;
            $scope.cancelEdit();
            $scope.getRealms();
        });
    };

    $scope.delRealm = function (name) {
        ConfigFactory.delRealm(name, function (data) {
            $scope.set_result = data.result.value;
            $scope.getRealms();
        });
    };

    $scope.setDefaultRealm = function (name) {
        ConfigFactory.setDefaultRealm(name, function (data) {
            $scope.set_result = data.result.value;
            $scope.getRealms();
        });
    };

    $scope.clearDefaultRealm = function () {
        ConfigFactory.clearDefaultRealm(function (data) {
            $scope.set_result = data.result.value;
            $scope.getRealms();
        });
    };

    $scope.startEdit = function (realmname, realm) {
        $scope.editRealm = realmname;
        // fill the selectedResolvers with the resolver of the realm
        $scope.selectedResolvers = {};
        angular.forEach(realm.resolver, function (resolver, _keyreso) {
            $scope.selectedResolvers[resolver.name] = true;
        })
    };

    $scope.cancelEdit = function () {
        $scope.editRealm = null;
        $scope.selectedResolvers = {};
    };

    $scope.editResolver = function (resolvername, r_type) {
        // change the view to the config.resolvers.edit
        $state.go("config.resolvers.edit" + r_type, {'resolvername': resolvername});
        $rootScope.returnTo = "config.resolvers.list";
    };

    $scope.getRealms();
    $scope.getResolvers();
    $scope.selectedResolvers = {};

    $scope.showResult = false;
    $scope.testResolver = function () {
        ConfigFactory.testResolver($scope.params, function (data) {
            $scope.result = {
                result: data.result.value,
                description: data.detail.description
            };
            $scope.showResult = true;
        });
    };

    $scope.saveSystemConfig = function () {
        ConfigFactory.saveSystemConfig($scope.params, function (data) {
            console.log($scope.params);
            console.log(data);
        })
    };
    $scope.getSystemConfig = function () {
        ConfigFactory.getSystemConfig(function (data) {
            console.log(data);
            $scope.params = data.result.value;
            $scope.params.PrependPin = $scope.isChecked($scope.params.PrependPin);
            $scope.params.splitAtSign = $scope.isChecked($scope.params.splitAtSign);
            $scope.params.IncFailCountOnFalsePin = $scope.isChecked($scope.params.IncFailCountOnFalsePin);
            $scope.params.ReturnSamlAttributes = $scope.isChecked($scope.params.ReturnSamlAttributes);
            $scope.params.AutoResync = $scope.isChecked($scope.params.AutoResync);
            $scope.params.PassOnUserNotFound = $scope.isChecked($scope.params.PassOnUserNotFound);
            $scope.params.PassOnUserNoToken = $scope.isChecked($scope.params.PassOnUserNoToken);
            $scope.params.UiLoginDisplayHelpButton = $scope.isChecked($scope.params.UiLoginDisplayHelpButton);
            $scope.params.UiLoginDisplayRealmBox = $scope.isChecked($scope.params.UiLoginDisplayRealmBox);
            console.log($scope.params);
        })
    };
    $scope.getSystemConfig();

});

myApp.controller("PasswdResolverController", function ($scope, ConfigFactory, $state, $stateParams) {
    $scope.params = {
        type: 'passwdresolver',
        fileName: "/etc/passwd"
    };

    $scope.resolvername = $stateParams.resolvername;
    if ($scope.resolvername) {
        /* If we have a resolvername, we do an Edit
         and we need to fill all the $scope.params */
        ConfigFactory.getResolver($scope.resolvername, function (data) {
            var resolver = data.result.value[$scope.resolvername];
            $scope.params = resolver.data;
            $scope.params.type = 'passwdresolver';
        });
    }

    $scope.setResolver = function () {
        ConfigFactory.setResolver($scope.resolvername, $scope.params, function (data) {
            $scope.set_result = data.result.value;
            $scope.getResolvers();
            $state.go("config.resolvers.list");
        });
    };
});

myApp.controller("LdapResolverController", function ($scope, ConfigFactory, $state, $stateParams) {
    /*
     BINDDN, BINDPW, LDAPURI, TIMEOUT, LDAPBASE, LOGINNAMEATTRIBUTE,
     LDAPSEARCHFILTER,
     LDAPFILTER, USERINFO, SIZELIMIT, NOREFERRALS, CACERTIFICATE, AUTHTYPE
     */
    $scope.params = {
        SIZELIMIT: 500,
        TIMEOUT: 5,
        UIDTYPE: "DN",
        type: 'ldapresolver',
        AUTHTYPE: "Simple"
    };
    $scope.result = {};
    $scope.resolvername = $stateParams.resolvername;
    $scope.authtypes = ["Simple", "SASL Digest-MD5"];

    if ($scope.resolvername) {
        /* If we have a resolvername, we do an Edit
         and we need to fill all the $scope.params */
        ConfigFactory.getResolver($scope.resolvername, function (data) {
            var resolver = data.result.value[$scope.resolvername];
            console.log(resolver);
            $scope.params = resolver.data;
            $scope.params.NOREFERRALS = ($scope.params.NOREFERRALS == "1");
            $scope.params.type = 'ldapresolver';
        });
    }

    $scope.presetAD = function () {
        $scope.params.LOGINNAMEATTRIBUTE = "sAMAccountName";
        $scope.params.LDAPSEARCHFILTER = "(sAMAccountName=*)(objectClass=person)";
        $scope.params.LDAPFILTER = "(&(sAMAccountName=%s)(objectClass=person))";
        $scope.params.USERINFO = '{ "username": "sAMAccountName", "phone" : "telephoneNumber", "mobile" : "mobile", "email" : "mail", "surname" : "sn", "givenname" : "givenName" }';
        $scope.params.NOREFERRALS = true;
        $scope.params.SIZELIMIT = 500;
        $scope.params.UIDTYPE = "DN";
        $scope.params.AUTHTYPE = "SASL Digest-MD5";
    };

    $scope.presetLDAP = function () {
        $scope.params.LOGINNAMEATTRIBUTE = "uid";
        $scope.params.LDAPSEARCHFILTER = "(uid=*)(objectClass=inetOrgPerson)";
        $scope.params.LDAPFILTER = "(&(uid=%s)(objectClass=inetOrgPerson))";
        $scope.params.USERINFO = '{ "username": "uid", "phone" : "telephoneNumber", "mobile" : "mobile", "email" : "mail", "surname" : "sn", "givenname" : "givenName" }';
        $scope.params.NOREFERRALS = true;
        $scope.params.SIZELIMIT = 500;
        $scope.params.UIDTYPE = "entryUUID";
        $scope.params.AUTHTYPE = "SASL Digest-MD5";
    };

    $scope.setLDAPResolver = function () {
        ConfigFactory.setResolver($scope.resolvername, $scope.params, function (data) {
            $scope.set_result = data.result.value;
            $scope.getResolvers();
            $state.go("config.resolvers.list");
        });
    };

    $scope.testResolver = function () {
        ConfigFactory.testResolver($scope.params, function (data) {
            $scope.result = {
                result: data.result.value,
                description: data.detail.description
            };
            $scope.showResult = true;
        });
    }

});

myApp.controller("SqlResolverController", function ($scope, ConfigFactory, $state, $stateParams) {
    /*

     */
    $scope.params = {
        type: 'sqlresolver'
    };
    $scope.result = {};
    $scope.resolvername = $stateParams.resolvername;
    $scope.showResult = false;

    if ($scope.resolvername) {
        /* If we have a resolvername, we do an Edit
         and we need to fill all the $scope.params */
        ConfigFactory.getResolver($scope.resolvername, function (data) {
            var resolver = data.result.value[$scope.resolvername];
            console.log(resolver);
            $scope.params = resolver.data;
            $scope.params.type = 'sqlresolver';
        });
    }

    $scope.presetWordpress = function () {
        $scope.params.Table = "wp_users";
        $scope.params.Map = '{ "userid" : "ID", "username": "user_login", "email" : "user_email", "givenname" : "display_name", "password" : "user_pass" }';
    };

    $scope.presetOTRS = function () {
        $scope.params.Table = "users";
        $scope.params.Map = '{ "userid" : "id", "username": "login", "givenname" : "first_name", "surname" : "last_name", "password" : "pw" }';
    };

    $scope.presetTine = function () {
        $scope.params.Table = "tine20_accounts";
        $scope.params.Map = '{ "userid" : "id", "username": "login_name", "email" : "email", "givenname" : "first_name", "surname" : "last_name", "password" : "password" }';
    };

    $scope.presetOwncloud = function () {
        $scope.params.Table = "oc_users";
        $scope.params.Map = '{ "userid" : "uid", "username": "uid", "givenname" : "displayname", "password" : "password" }';
    };

    $scope.setSQLResolver = function () {
        ConfigFactory.setResolver($scope.resolvername, $scope.params, function (data) {
            $scope.set_result = data.result.value;
            $scope.getResolvers();
            $state.go("config.resolvers.list");
        });
    };

    $scope.testSQL = function () {
        ConfigFactory.testResolver($scope.params, function (data) {
            $scope.result = {
                result: data.result.value,
                description: data.detail.description
            };
            $scope.showResult = true;
        });
    }

});