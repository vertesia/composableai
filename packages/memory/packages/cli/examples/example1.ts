//@ts-ignore
import { vars, exec, media, content, tmpdir, pdf } from "@becomposable/memory-commands";

console.log('!!!!!!', vars);

const r = await exec("ls -al");

console.log('#######', r);

export default {
    msg: "hello",
    pdf: pdf('./fixtures/test.pdf'),
    images: media('/Users/bogdan/work/js/memory/images/L1009972.jpg'),
    code: content('./examples/example1.ts'),
};
