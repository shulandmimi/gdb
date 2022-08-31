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
    // bac_1();
}

abc();

// function run() {
//     gdb('123123');
// }

// run();

// function main() {
//     function wrap() {
//         new Promise((resolve) => {
//             resolve(123);
//         }).then(() => {
//             console.log(new Error('哈哈哈').stack);
//         });
//     }
//     wrap();
// }

// main();

// setInterval(() => {
//   abc();
// }, 5000);

export {};
