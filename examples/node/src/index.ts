import gdb from '@gdb/node';
import delay from './utils/delay';

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

async function main() {
    await delay(2000);

    await new Promise(async (resolve) => {
        await delay(2000);
        gdb('hello async/await');
    });
}

main();
