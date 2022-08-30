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

    // console.log(new Error());
    // bac_1();
}

abc();

// setInterval(() => {
//   abc();
// }, 5000);

export {};
