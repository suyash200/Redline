export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface ChangedFile {
    path: string;
    status: FileStatus;
    additions: number;
    deletions: number;
    oldPath?: string;
}

export interface CommitInfo {
    hash: string;
    message: string;
    author: string;
    date: string;
}
