import '@gdb/browser/dist/mjs/runtime/trace';
import gdb from '@gdb/browser';

function abc() {
    function abc_1() {
        setTimeout(() => {
            bac();
        });
    }

    abc_1();
}

function bac_1() {
    console.log(new Error());
}

function bac() {
    gdb('hello world');

    console.log(new Error());
    bac_1();
}

abc();

// function run() {
//     gdb('123123');
// }

// run();

function main() {
    function wrap() {
        new Promise((resolve) => {
            console.log(1);
            resolve(123);
            console.log(2);
        }).then(() => {
            console.log(new Error().stack);
        });
    }
    wrap();
}

// main();

// setTimeout(() => {
//     main();
// }, 1000);

export {};
