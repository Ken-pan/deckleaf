// The sample is an optional import, using the same document validation path.
export async function openSample(importFiles:(files:File[])=>Promise<void>){
  const response=await fetch('/examples/decksprig-demo.deck.json');
  if(!response.ok)throw new Error('The sample could not be loaded. Download the sample Deck file from the guide and import it.');
  await importFiles([new File([await response.blob()],'decksprig-demo.deck.json',{type:'application/json'})]);
}
