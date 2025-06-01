import * as path from 'path';
import { glob } from 'glob';

export function run(): Promise<void> {
    // Создаем новый экземпляр Mocha
    const Mocha = require('mocha');
    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 10000,
        reporter: 'spec'
    });

    // Устанавливаем глобальные функции Mocha
    (global as any).suite = mocha.suite.bind(mocha);
    (global as any).test = mocha.test.bind(mocha);
    (global as any).beforeEach = mocha.beforeEach.bind(mocha);
    (global as any).afterEach = mocha.afterEach.bind(mocha);
    (global as any).before = mocha.before.bind(mocha);
    (global as any).after = mocha.after.bind(mocha);

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((c, e) => {
        glob('**/**.test.js', { cwd: testsRoot }).then((files: string[]) => {
            // Добавляем файлы в test suite
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Запускаем тесты
                mocha.run((failures: number) => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err) {
                console.error(err);
                e(err);
            }
        }).catch((err: any) => {
            e(err);
        });
    });
} 