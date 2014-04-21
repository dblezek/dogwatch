

// Configuration for require.js
// foundation, xtk and dat.gui are loaded by default
require.config({
  baseURL: 'js',
  // Some packages do not provide require info, so we 'shim' them here
  shim: {
    'angular': { exports: 'angular'},
    'angular-route': ['angular'],
    'angular-ui-router' : ['angular'],
    'ui-ace' : ['angular'],
    // The angularAMD and ngload let us load a page and add angular apps later
    'angularAMD':['angular'],
    'ngload':['angularAMD'],
    'ui-bootstrap-tpls':['angular']
  }
})

// To work, the model, angular and angularAMD packages are required
require(['angular', 'angularAMD', "backbone", 'moment', 'angular-ui-router', 'ui-bootstrap-tpls', 'ui-ace', 'ace/ace' ], function(angular, angularAMD, Backbone, moment ) {

  // Helper for shortening strings
  String.prototype.trunc = String.prototype.trunc ||
  function(n){
    return this.length>n ? this.substr(0,n-1)+'...' : this;
  };

  String.prototype.startsWith = String.prototype.startsWith ||
  function (str){
    return this.indexOf(str) == 0;
  };

  WatchModel = Backbone.Model.extend({
    defaults: {
      worry: 10,
      cron: "0 0 * * * ?",
      show: false,
      checks: null
    }
  });

  WatchCollection = Backbone.Collection.extend({
    model: WatchModel,
    url: '/rest/watch',
  });

  CheckModel = Backbone.Model.extend({});
  CheckCollection = Backbone.Collection.extend({
    model: CheckModel,
    url: function () { return this.urlRoot; },
  });

  dogwatchApp = angular.module('dogwatchApp', ['ui.router', 'ui.bootstrap', 'ui.ace']);

  dogwatchApp.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.when('', '/index')
    $urlRouterProvider.otherwise('/index/home')
    $stateProvider
    .state('index', {
      abstract: false,
      url: "/index",
      templateUrl: 'partials/dogwatch.html',
      controller: 'DogwatchController'
    })
    .state('index.index', {
      url: "/home",
      templateUrl: 'partials/dogwatch.index.html',
      controller: 'WatchController'
    })
    .state('index.watches', {
      url: "/watches",
      templateUrl: 'partials/watches.html',
      controller: 'WatchController'
    })
    .state('index.login', {
      url: "/login",
      templateUrl: 'partials/login.html',
      controller: 'LoginController'
    })
    .state('index.register', {
      url: "/register",
      templateUrl: 'partials/register.html',
      controller: 'RegisterController'
    }).state('hash', {
      abstract: false,
      url: "/hash",
      templateUrl: 'partials/hash.html',
      controller: 'LoginController'
    }).state('hasherror', {
      abstract: false,
      url: "/hash/error",
      templateUrl: 'partials/hash.error.html'
    })
  });

    // ['$routeProvider',
    // function($routeProvider){
    //   $routeProvider.
    //   when('/', {
    //     templateUrl: 'partials/pools.html',
    //     controller: 'PoolsController'
    //   });
    // }]);

dogwatchApp.controller ( 'LoginController', function($scope,$http,$location) {
  console.log("Starting Login")
  $scope.login = function() {
    console.log ( "Login with ", $scope.user)
    $http(
      { url:"/login",
      method: "POST",
      data: $.param($scope.user),
      headers: {'Content-Type': 'application/x-www-form-urlencoded'}
    })
      .success(function(data) {
        $scope.$parent.checkLogin()
        $location.url('/');
    })
    .error(function(data, status, headers, config) {
      $scope.error = data.message
    });
  };
});


dogwatchApp.controller ( 'RegisterController', function($scope,$http,$location) {
  console.log("Starting Register")
  $scope.user = { agree: false, password:null }
  $scope.register = function() {
    $scope.error = ""
    console.log("Register clicked", $scope.user)
    if (!$scope.user.agree) {
      $scope.error = "You must agree to Terms and Conditions before registration!"
      return
    }

    console.log ( "Register with ", $scope.user)
    $http(
      { url:"/login/register",
      method: "POST",
      data: $.param($scope.user),
      headers: {'Content-Type': 'application/x-www-form-urlencoded'}
    })
      .success(function(data) {
        $location.url('/');
    })
    .error(function(data, status, headers, config) {
      $scope.error = data.message
    });
  };
});



  dogwatchApp.controller ( 'WatchController', function($scope,$timeout,$state,$http,$modal) {
    console.log("Starting WatchController");
    $scope.watches = new WatchCollection();
    $scope.watches.fetch({remove:true,async:false})
    $scope.moment = moment;

    $scope.show = function(watch) {
      watch.set("show", !watch.get("show"))
      $scope.reloadChecks(watch);
    };

    $scope.reloadChecks = function(watch) {
      var c;
      if ( !watch.has("checks")) {
        c = new CheckCollection();
        c.urlRoot = "/rest/watch/" + watch.get("id") + "/lookout"
        watch.set("checks", c);
      }
      c = watch.get("checks");
      console.log (c )
      c.fetch({
        success: function(data) {
          console.log("Got the checks for ", watch)
          $scope.$apply()
        }
      });

    };

    $scope.help = function(watch) {
      $modal.open({
        templateUrl: 'partials/watch.help.html',
        scope: $scope,
        controller: function($scope,$modalInstance) {
          $scope.checks = new CheckCollection();
          $scope.watch = watch;
          $scope.checks.urlRoot = "/rest/watch/" + watch.get("id") + "/lookout"
          $scope.checks.fetch({remove:true, async:false})
          $scope.cancel = function() { $modalInstance.dismiss() }
        }
      })
    }


    $scope.editWatch = function(watch) {
      console.log(watch)
      var title = "Edit the watch"
      if ( !watch ) {
        title = "Create a new watch"
        watch = new WatchModel();
      }
      $scope.watch = watch
      $modal.open({
        templateUrl: 'partials/watch.edit.html',
        scope: $scope,
        controller: function($scope,$modalInstance) {
          $scope.title = title
          $scope.watchModel = watch.toJSON();
          $scope.valid = false

          $scope.validate = function(){
            var tempWatch = new WatchModel($scope.watchModel);
            $http.post("/rest/watch/validate", tempWatch)
            .success(function(data) {
              $scope.valid = data.valid
              $scope.explanation = ""
              $scope.error = data.messages.join("\n");
              if ( data.explanation ) {
                $scope.explanation = " (" + data.explanation + ")";
              }
            });
          }


          $scope.save = function(){
            watch.set ( $scope.watchModel )
            // Add emails!
            $scope.watches.add(watch)
            watch.save();
            $modalInstance.close();
          };
          $scope.cancel = function() { $modalInstance.dismiss() };
          $scope.validate();
        }
      })
    }

  });

  dogwatchApp.controller ( 'DogwatchController', function($scope,$timeout,$location,$http) {
    console.log("Starting DogwatchController")
    // See if we're logged in?
    $scope.logout = function() {
      $http.post("/login/logout").success(function(data) {
        $scope.checkLogin()
      });
    };
    $scope.checkLogin = function() {
      $http.get("/login").success(function(data){
        console.log("Login info", data)
        $scope.data = data
        $scope.loggedIn = false
        // Logged in?
        if ( data.user ) {
          $scope.loggedIn = true
          $location.url("/watches")        
        } else {
          $location.url("/")
        }
      })
    };
    $scope.checkLogin();
  });


  // Here is where the fun happens. angularAMD contains support for initializing an angular
  // app after the page load.
  angularAMD.bootstrap(dogwatchApp);

  console.log ("Build dogwatch app")
})
