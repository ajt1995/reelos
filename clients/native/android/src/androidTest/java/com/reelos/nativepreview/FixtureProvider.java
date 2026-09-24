package com.reelos.nativepreview;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.InputStream;
import java.io.FileOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;

/** Runs in the test APK's own process without target-app/Kotlin dependencies. */
public final class FixtureProvider extends ContentProvider {
    private static int mutableOpenCount = 0;
    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri uri) { return "video/mp4"; }
    private String asset(Uri uri) {
        if ("valid".equals(uri.getLastPathSegment())) return "Native-Validation-30s.mp4";
        if ("tracks".equals(uri.getLastPathSegment())) return "Native-Tracks-30s.mp4";
        if ("invalid".equals(uri.getLastPathSegment())) return "invalid-video.mp4";
        if ("mutable".equals(uri.getLastPathSegment())) return "Mutable-Validation.mp4";
        throw new IllegalArgumentException("Unknown fixture");
    }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String order) {
        String[] columns = projection != null ? projection : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor cursor = new MatrixCursor(columns);
        Object[] row = new Object[columns.length];
        for (int i = 0; i < columns.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) row[i] = asset(uri);
        }
        cursor.addRow(row);
        return cursor;
    }
    @Override public synchronized ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException("Read-only fixture");
        String name = asset(uri);
        if ("mutable".equals(uri.getLastPathSegment())) {
            // The old import path verified the first two opens, then copied corrupt bytes.
            name = mutableOpenCount++ < 2 ? "Native-Validation-30s.mp4" : "invalid-video.mp4";
        }
        File file = new File(getContext().getCacheDir(), name);
        if (!file.exists()) {
            try (InputStream input = getContext().getAssets().open(name); FileOutputStream output = new FileOutputStream(file)) {
                byte[] buffer = new byte[65536];
                int count;
                while ((count = input.read(buffer)) >= 0) output.write(buffer, 0, count);
                output.getFD().sync();
            } catch (IOException error) {
                file.delete();
                throw new FileNotFoundException("Test asset unavailable: " + error.getMessage());
            }
        }
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException("Read-only fixtures"); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new UnsupportedOperationException("Read-only fixtures"); }
    @Override public int delete(Uri uri, String selection, String[] args) { throw new UnsupportedOperationException("Read-only fixtures"); }
}
