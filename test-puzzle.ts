import { puzzleCaptchaUtil } from './src/features/common/puzzle-captcha.js';

console.log('Testing Puzzle Captcha Util...');

const puzzle = puzzleCaptchaUtil.generate();
console.log('Puzzle Generated:');
console.log('- Token:', puzzle.token);
console.log('- Y:', puzzle.y);
console.log('- BG SVG length:', puzzle.bgSvg.length);
console.log('- Piece SVG length:', puzzle.pieceSvg.length);

// Extract targetX from token (manually for logic check)
const decoded = Buffer.from(puzzle.token, 'base64').toString();
const [targetXStr] = decoded.split(':');
const targetX = parseInt(targetXStr);
console.log('- Hidden Target X:', targetX);

// Test Verification
const resultCorrect = puzzleCaptchaUtil.verify(targetX, puzzle.token);
console.log('Verify with correct X:', resultCorrect ? 'SUCCESS' : 'FAILED');

const resultCorrectNear = puzzleCaptchaUtil.verify(targetX + 2, puzzle.token);
console.log('Verify with X + 2:', resultCorrectNear ? 'SUCCESS' : 'FAILED');

const resultWrong = puzzleCaptchaUtil.verify(targetX + 20, puzzle.token);
console.log('Verify with X + 20:', resultWrong ? 'FAILED (EXPECTED)' : 'SUCCESS (WRONG)');

const resultExpired = puzzleCaptchaUtil.verify(targetX, Buffer.from(`100:0:invalid`).toString('base64'));
console.log('Verify with invalid/expired token:', resultExpired ? 'SUCCESS (WRONG)' : 'FAILED (EXPECTED)');
