import gdb from '@gdb/node';

gdb('hello world');

gdb('1');

gdb(123);

gdb('2');

gdb('3');

gdb('4');

function gdb_wrapper() {
    gdb('5 in scope');
}
gdb_wrapper();

setTimeout(() => {
    gdb('in settimeout');
}, 1000);

function setTimeoutScope() {
    setTimeout(() => {
        gdb('in settimeout and scope');
    }, 1000);
}

setTimeoutScope();
