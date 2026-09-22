import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Cleaning house via MJS...');
execSync('powershell -ExecutionPolicy Bypass -File ' + path.resolve('scripts/clean-house.ps1'), { stdio: 'inherit' });
