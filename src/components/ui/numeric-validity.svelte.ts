import {setContext} from 'svelte';

/** Draft forms must not apply a stale valid value while a number field is invalid. */
export function numericFieldValidity() {
  let invalid = $state<Record<string, boolean>>({});
  setContext('numeric-validity', (id: string, valid?: boolean) => {
    if (valid === undefined) {if (id in invalid) {const next = {...invalid}; delete next[id]; invalid = next;}}
    else if (Boolean(invalid[id]) === valid) invalid = {...invalid, [id]: !valid};
  });
  return {get valid() {return !Object.values(invalid).some(Boolean);}};
}
