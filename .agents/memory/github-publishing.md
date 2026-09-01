---
name: GitHub publishing
description: Publishing a workspace tree to an empty GitHub repository through the Replit-managed connection
---

When publishing to a completely empty GitHub repository, initialize the default branch with a small Contents API commit first. Git Data API tree creation can return HTTP 409 while the repository has no commits; after initialization, create the full tree, commit, and update the branch ref through the authenticated SDK.

**Why:** GitHub treats an empty repository differently from a repository with an existing ref, and direct tree creation is rejected before the first commit exists.

**How to apply:** Check the remote default branch first; if it is empty, create the initial commit, then use its branch head as the parent of the full source import. Keep credential-bearing files out of the local file list before uploading.

## Authenticated fallback

If the local HTTPS remote rejects credentials but the GitHub integration is installed, publish through the authenticated GitHub connection's Git Data API instead of asking for a token.

**Why:** Replit-managed GitHub authorization can be available to the agent even when local Git credential helpers are not configured.

**How to apply:** Read the current remote branch head, build the changed-file tree on top of it, create a non-force commit, and update the branch ref.