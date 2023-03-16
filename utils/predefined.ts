export function expand(obj: Object | any) {
  var keys = Object.keys(obj)
  for (var i = 0; i < keys.length; ++i) {
    var key = keys[i],
      subkeys = key.split(/,\s?/),
      target = obj[key]
    delete obj[key]
    subkeys.forEach(function (key) {
      obj[key] = target
    })
  }
  return obj
}
