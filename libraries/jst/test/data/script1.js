// test unsupported keywords: 10 errors

class X {}

let x, y;
with (x) {
    y = 1;
}

for (let i = 0; ; ) {}

while (true) {
    break;
}

// using this not allowed
function testThis() {
    console.log(this);
}

console.log({}.constructor);
console.log({}.prototype);
console.log({}.__proto__);

const constructorLabel = () => 'constructor';

const a = {};
console.log(a['constr' + 'uctor']);
console.log(a[constructorLabel()]);
