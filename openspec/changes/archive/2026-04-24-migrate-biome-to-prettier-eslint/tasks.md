## 1. Remove Biome

- [x] 1.1 Uninstall `@biomejs/biome` from devDependencies
- [x] 1.2 Delete `biome.json` from the project root
- [x] 1.3 Remove Biome references from `package.json` scripts and `lint-staged`

## 2. Install New Dependencies

- [x] 2.1 Install `prettier` as a devDependency
- [x] 2.2 Install `prettier-plugin-organize-imports` as a devDependency
- [x] 2.3 Install `eslint` as a devDependency
- [x] 2.4 Install `@eslint/js` as a devDependency
- [x] 2.5 Install `typescript-eslint` as a devDependency
- [x] 2.6 Install `eslint-config-prettier` as a devDependency

## 3. Create Prettier Configuration

- [x] 3.1 Create `.prettierrc` with `trailingComma: "all"`, `tabWidth: 2`, `semi: true`, and `plugins: ["prettier-plugin-organize-imports"]`
- [x] 3.2 Verify `.prettierrc` is not ignored by `.gitignore`

## 4. Create ESLint Configuration

- [x] 4.1 Create `eslint.config.js` with flat config importing `@eslint/js`, `typescript-eslint`, and `eslint-config-prettier/flat`
- [x] 4.2 Configure `ignores` for `node_modules`, `dist`, `.git`, and `dotfiles/pi/agent/settings.json`
- [x] 4.3 Ensure `eslint-config-prettier/flat` is the last config object in the array

## 5. Update npm Scripts and Automation

- [x] 5.1 Update `package.json` `check` script to run `prettier --write . && eslint --fix . && tsc --noEmit && openspec validate --all --json`
- [x] 5.2 Update `lint-staged` to run `prettier --write` and `eslint --fix` for staged `*.{ts,js,json,jsonc}` files
- [x] 5.3 Verify `prepare` script still runs `husky`

## 6. Reformat and Validate

- [x] 6.1 Run `npx prettier --write .` to reformat all files
- [x] 6.2 Run `npx eslint --fix .` to auto-fix any lint issues
- [x] 6.3 Run `npm run check` to verify the full check pipeline passes
- [x] 6.4 Run `npm test` to ensure tests still pass after reformatting

## 7. Commit and Cleanup

- [x] 7.1 Review the diff to ensure no unintended changes
- [x] 7.2 Commit the tooling migration and mass reformat
- [x] 7.3 Verify `lint-staged` works on a test commit
