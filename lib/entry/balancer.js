var debug = require('debug')('micromono:entry:balancer')
var Router = require('../web/router')
var argsNames = require('js-args-names')
var AssetPipe = require('../web/asset')
var LocalPipe = require('../service/local')
var HealthPipe = require('../server/health')
var ServerPipe = require('../server/pipe')
var RemotePipe = require('../service/remote')
var DiscoveryPipe = require('../discovery/pipe')
var ServicePipeline = require('../pipeline/service')
var BalancerPipeline = require('../pipeline/balancer')
var ChannelGatewayPipe = require('../channel/gateway')


exports.startBalancer = function(app, opts, callback) {
  if ('function' === typeof opts) {
    callback = opts
    opts = undefined
  }
  opts = opts || {}

  var micromono = this
  var packagePath = ServerPipe.getCallerPath()
  debug('Balancer packagePath "%s"', packagePath)

  // Use 3000 as default port for balancer
  if (!micromono.get('MICROMONO_PORT'))
    micromono.set('MICROMONO_PORT', 3000)

  var frameworkType = opts.framework || 'express'
  var framework = ServerPipe.initFramework(frameworkType).framework

  micromono
    .set(Router, '*^')
    .set(AssetPipe, '*^')
    .set(LocalPipe, '*^')
    .set(HealthPipe, '*^')
    .set(RemotePipe, '*^')
    .set(ServerPipe, '*^')
    .set(DiscoveryPipe, '*^')
    .set(ChannelGatewayPipe, '*^')
    .set('mainApp', app || undefined)
    .set('require', micromono.require.bind(micromono))
    .set('micromono', micromono)
    .set('mainFramework', framework)
    // Balancer asset management
    .set('balancerPackagePath', packagePath)
    .set('errorHandler', function(err, errPipeName) {
      debug('[%s] `startBalancer` pipeline error', errPipeName, err && err.stack || err)
      process.exit(1)
    })

  var balancer = BalancerPipeline.initBalancer
    .concat(ServicePipeline.listenRemoteProviders)
    .concat(ServicePipeline.startHealthinessServer)

  if ('function' === typeof callback)
    balancer.pipe(callback, argsNames(callback))

  balancer
    .error('errorHandler', [null, 'errPipeName'])
    .debug(micromono.get('MICROMONO_DEBUG_PIPELINE') && debug)

  balancer.toPipe(micromono.superpipe, 'startBalancer')()
}
