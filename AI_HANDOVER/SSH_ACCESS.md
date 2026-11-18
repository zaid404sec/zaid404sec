# SSH access — GitHub source repository

## Repository addresses

SSH remote:
git@github.com:zaid404sec/zaid404sec.git

HTTPS remote:
https://github.com/zaid404sec/zaid404sec.git

The app's cloud database uses Supabase HTTPS APIs. It does not use SSH to connect to Supabase. SSH is optional and only for GitHub repository access from a developer machine.

## Create a new SSH key

On a Windows, macOS or Linux developer computer with OpenSSH installed, run:

ssh-keygen -t ed25519 -C "your GitHub account email"

Accept the default key location or choose a secure location. Use a passphrase when possible. This produces a private key and a public key:
- Private: id_ed25519
- Public: id_ed25519.pub

Add only the contents of id_ed25519.pub to GitHub:
https://github.com/settings/keys

Choose New SSH key, select Authentication Key, paste the public key and save. Never upload id_ed25519.

Test the connection:
ssh -T git@github.com

Clone the source repository:
git clone git@github.com:zaid404sec/zaid404sec.git

## Android / Termux option

Install Termux from its trusted source, install OpenSSH with the package manager, then run ssh-keygen -t ed25519 -C "your GitHub account email". Display the public key file and add only that public text to GitHub Settings → SSH and GPG keys. Keep the private key inside Termux's private home directory.

## Critical security rule

This project ZIP intentionally does not include an SSH private key. A private key grants access as its owner and must remain on the device that generated it. Do not place it in the project folder, GitHub repository, app assets, APK, EXE, Google Drive share or a handover ZIP. If you change computers, create a new key on the new computer and add its public key to GitHub. Remove old public keys from GitHub when a device is retired.

No SSH login to the Supabase database or to a WashDesk server is part of this project's runtime architecture.
