import { spawnSync } from "node:child_process";
// This runner only uses the isolated localhost fixture in security.test.ts.
// Never seed synthetic accounts or send OTP bursts to the live website.
for (const size of [100, 200, 500]) {
  console.log(`Running isolated ${size}-student stage`);
  const result = spawnSync(process.execPath, ["--test", "--test-name-pattern=existing students", "tests/security.test.ts"], {
    env: {...process.env, CLASSROOM_SIZE:String(size), CLASSROOM_BENCHMARK:"true", PERFORMANCE_LOGS:"false"},
    windowsHide:true, stdio:"inherit", timeout:180000,
  });
  if (result.status !== 0) {
    console.error(`Stopped at ${size} students. Inspect failures before increasing load.`);
    process.exit(1);
  }
}
