import type {Deck} from './model';
import type {Proposal} from './operations';
import {diffProposal} from './proposal-copy';

export function proposalReviewRange(count:number,requestedPage:number) {
  const pages=Math.max(1,Math.ceil(count/20)),page=Math.max(0,Math.min(pages-1,requestedPage));
  return {page,pages,start:page*20,end:Math.min(count,(page+1)*20)};
}

/** Presentation is bounded; the underlying proposal and atomic apply stay whole. */
export function proposalReviewChanges(deck:Deck,proposal:Proposal,page:number) {
  const range=proposalReviewRange(proposal.operations.length,page);
  return diffProposal(deck,{...proposal,operations:proposal.operations.slice(range.start,range.end)});
}
