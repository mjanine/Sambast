#!/usr/bin/env bash
# exit on error
set -o errexit

# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the sequence reset script 
# This ensures Supabase and Render are in sync from the start
python reset_sequences.py