"use strict";
exports.__esModule = true;
var node_1 = require("@gdb/node");
(0, node_1["default"])('hello world');
(0, node_1["default"])('1');
(0, node_1["default"])(123);
(0, node_1["default"])('2');
(0, node_1["default"])('3');
(0, node_1["default"])('4');
function gdb_wrapper() {
    (0, node_1["default"])('5 in scope');
}
gdb_wrapper();
setTimeout(function () {
    (0, node_1["default"])('in settimeout');
}, 1000);
function setTimeoutScope() {
    setTimeout(function () {
        (0, node_1["default"])('in settimeout and scope');
    }, 1000);
}
setTimeoutScope();
//# sourceMappingURL=index.js.map