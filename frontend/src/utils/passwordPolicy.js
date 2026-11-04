import policy from '../../../shared/password-policy.json' with { type: 'json' };
export const passwordMessage = policy.message;
const pattern = new RegExp(policy.pattern);
export const isValidPassword = value => typeof value === 'string' && pattern.test(value);
