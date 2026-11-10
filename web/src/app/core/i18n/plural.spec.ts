import { pluralKeys } from './plural';

describe('pluralKeys', () => {
  it('asks for the one form first when the count is one', () => {
    expect(pluralKeys('list.count', 1, 'he')).toEqual(['list.count.one', 'list.count.other']);
  });

  it('asks for the dual form first when the count is two in Hebrew', () => {
    expect(pluralKeys('list.count', 2, 'he')).toEqual(['list.count.two', 'list.count.other']);
  });

  it('asks only for the other form when the count has no category of its own', () => {
    expect(pluralKeys('list.count', 23, 'he')).toEqual(['list.count.other']);
    expect(pluralKeys('list.count', 0, 'he')).toEqual(['list.count.other']);
  });
});
