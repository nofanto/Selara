// The in-app user guide's sidebar: every page under docs/user-guide/ the Help view can open.
// Kept out of HelpView so a plain unit test can check it against the files on disk
// (guideSections.test.ts): a page missing from here is unreachable in the app.

export interface GuidePage {
  title: string;
  path: string;
}

export interface GuideSection {
  title: string;
  pages: GuidePage[];
}

export const SECTIONS: GuideSection[] = [
  {
    title: 'Getting Started',
    pages: [
      { title: 'What is Selara?',    path: '01-getting-started/what-is-selara' },
      { title: 'First Launch',       path: '01-getting-started/first-launch' },
      { title: 'Navigating the App', path: '01-getting-started/navigating-the-app' },
    ],
  },
  {
    title: 'Timeline',
    pages: [
      { title: 'Reading the Timeline',    path: '02-timeline/reading-the-timeline' },
      { title: 'Configuring the Window',  path: '02-timeline/configuring-the-window' },
      { title: 'Creating Initiatives',    path: '02-timeline/creating-initiatives' },
      { title: 'Moving and Resizing',     path: '02-timeline/moving-and-resizing' },
      { title: 'Conflict Detection',      path: '02-timeline/conflict-detection' },
      { title: 'Today Indicator',         path: '02-timeline/today-indicator' },
    ],
  },
  {
    title: 'Initiatives',
    pages: [
      { title: 'Editing an Initiative', path: '03-initiatives/editing-an-initiative' },
      { title: 'Initiative Fields',     path: '03-initiatives/initiative-fields' },
      { title: 'Deleting an Initiative', path: '03-initiatives/deleting-an-initiative' },
    ],
  },
  {
    title: 'Dependencies',
    pages: [
      { title: 'Drawing Dependencies',   path: '04-dependencies/drawing-dependencies' },
      { title: 'Dependency Types',       path: '04-dependencies/dependency-types' },
      { title: 'Editing Dependencies',   path: '04-dependencies/editing-dependencies' },
      { title: 'Milestone Dependencies', path: '04-dependencies/milestone-dependencies' },
      { title: 'Critical Path',          path: '04-dependencies/critical-path' },
    ],
  },
  {
    title: 'Deliverables',
    pages: [
      { title: 'Adding Deliverables',  path: '05-applications/adding-applications' },
      { title: 'Lifecycle Segments',   path: '05-applications/lifecycle-segments' },
      { title: 'Managing Segments',    path: '05-applications/managing-segments' },
      { title: 'Seeing What an Initiative Delivers', path: '05-applications/initiative-links' },
      { title: 'Display Mode',         path: '05-applications/display-mode' },
    ],
  },
  {
    title: 'Display Settings',
    pages: [
      { title: 'Colour Modes',    path: '06-display-settings/colour-modes' },
      { title: 'Grouping Modes',  path: '06-display-settings/grouping-modes' },
      { title: 'Inline Toggles',  path: '06-display-settings/inline-toggles' },
      { title: 'Zoom and Columns', path: '06-display-settings/zoom-and-columns' },
      { title: 'Legend',          path: '06-display-settings/legend' },
    ],
  },
  {
    title: 'Data Manager',
    pages: [
      { title: 'Overview',         path: '07-data-manager/overview' },
      { title: 'Inline Editing',   path: '07-data-manager/inline-editing' },
      { title: 'CSV Paste',        path: '07-data-manager/csv-paste' },
      { title: 'Search and Filter', path: '07-data-manager/search-and-filter' },
    ],
  },
  {
    title: 'Resources',
    pages: [
      { title: 'Resource Roster',     path: '08-resources/resource-roster' },
      { title: 'Assigning Resources', path: '08-resources/assigning-resources' },
    ],
  },
  {
    title: 'Reports',
    pages: [
      { title: 'Overview',                       path: '09-reports/overview' },
      { title: 'Initiatives & Dependencies',     path: '09-reports/initiatives-dependencies-report' },
      { title: 'Budget Report',                  path: '09-reports/budget-report' },
      { title: 'Capacity Report',                path: '09-reports/capacity-report' },
      { title: 'Maturity Heatmap',               path: '09-reports/maturity-heatmap-report' },
      { title: 'History Diff Report',            path: '09-reports/history-diff-report' },
      { title: 'Data Health Report',             path: '09-reports/data-health-report' },
    ],
  },
  {
    title: 'History',
    pages: [
      { title: 'Saving a Version',     path: '10-version-history/saving-a-version' },
      { title: 'Comparing Versions',   path: '10-version-history/comparing-versions' },
      { title: 'Restoring a Version',  path: '10-version-history/restoring-a-version' },
      { title: 'Recording a Decision', path: '13-decisions/recording-a-decision' },
      { title: 'Linking Decisions',    path: '13-decisions/linking-decisions' },
    ],
  },
  {
    title: 'Import & Export',
    pages: [
      { title: 'Backup and Restore', path: '11-import-export/backup-and-restore' },
      { title: 'Excel Import',     path: '11-import-export/excel-import' },
      { title: 'Excel Export',     path: '11-import-export/excel-export' },
      { title: 'PDF & SVG Export', path: '11-import-export/pdf-svg-export' },
      { title: 'RPTI Catalogue',   path: '11-import-export/rpti-catalogue' },
      { title: 'Sharing Links',    path: '11-import-export/sharing-links' },
    ],
  },
  {
    title: 'Mobile',
    pages: [
      { title: 'Card View',       path: '12-mobile/card-view' },
      { title: 'Mobile Settings', path: '12-mobile/mobile-settings' },
    ],
  },
  {
    title: 'RPTI Report',
    pages: [
      { title: 'Recording an RPTI Row',     path: '14-rpti-report/recording-an-rpti-row' },
      { title: 'Exporting the RPTI Report', path: '14-rpti-report/exporting-the-rpti-report' },
    ],
  },
  {
    title: 'LKPTI Report',
    pages: [
      { title: 'Recording LKPTI Rows',      path: '15-lkpti-report/recording-lkpti-rows' },
      { title: 'Importing an LKPTI Report', path: '15-lkpti-report/importing-an-lkpti-report' },
    ],
  },
];
