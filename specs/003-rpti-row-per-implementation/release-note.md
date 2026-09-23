# Release note: one RPTI line per implementation

- An application with two go-lives in the same filing year now produces two RPTI lines, one for
  each implementation.
- Work going live next year no longer appears in this year's return. This is an intentional
  behaviour change: each line belongs to the year its implementation starts.
- Filed CapEx, OpEx, and commentary are now entered on the implementation's lifecycle segment.
  Initiative CapEx and OpEx stay stored and editable as separate portfolio figures; the filing
  never reads them, and Data Health warns without blocking when the figures diverge.
- One initiative may now file implementations for several applications. The obsolete initiative
  Deliverable field (`Initiative.deliverableId`) and its UI controls have been removed.

