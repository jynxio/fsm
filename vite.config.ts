import { defineConfig } from "vite-plus";

export default defineConfig({
    pack: {
        dts: {
            tsgo: true,
        },
        exports: true,
    },
    lint: {
        options: {
            typeAware: true,
            typeCheck: true,
        },
    },
    fmt: {
        tabWidth: 4,
        printWidth: 100,
    },
});
