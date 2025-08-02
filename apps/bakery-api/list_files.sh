#!/bin/bash

# Script to list all files and print their content from the current directory
# Excludes node_modules, out, .next directories and .db files

# Define output file
OUTPUT_FILE="project_files.txt"

# Create or clear the output file
echo "=== Directory Content Listing ===" > "$OUTPUT_FILE"
echo "Excluded: node_modules, out, .next directories and .db files" >> "$OUTPUT_FILE"
echo "===============================" >> "$OUTPUT_FILE"
echo >> "$OUTPUT_FILE"

# Find all files excluding specified directories, .db files, and the output file itself
find . -type f \
    -not -path "*/node_modules/*" \
    -not -path "*/out/*" \
    -not -path "*/.next/*" \
    -not -path "*/\.*" \
    -not -name "*.db" \
    -not -name "$OUTPUT_FILE" \
    | sort \
    | while read -r file; do
        echo "FILE: $file" >> "$OUTPUT_FILE"
        echo "----------------------------------------" >> "$OUTPUT_FILE"

        # Check if file is binary
        if file "$file" | grep -q "text"; then
            # It's a text file, display content
            cat "$file" 2>/dev/null >> "$OUTPUT_FILE" ||
            echo "[Error: Could not display file content]" >> "$OUTPUT_FILE"
        else
            # It's a binary file
            echo "[Binary file - content not displayed]" >> "$OUTPUT_FILE"
        fi

        echo "----------------------------------------" >> "$OUTPUT_FILE"
        echo >> "$OUTPUT_FILE"
    done

echo "Files and content have been saved to $OUTPUT_FILE"
