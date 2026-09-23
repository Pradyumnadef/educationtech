import { useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  FileText,
  Folder,
  Home,
  Play,
  Search,
  ShieldCheck,
} from "lucide-react";
import PdfViewer from "../components/PdfViewer";
import {
  CourseArt,
  Empty,
  Failure,
  Item,
  Loading,
  Logo,
  useData,
} from "../lib";

type ExploreData = { content: Item[] };

function size(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function assetLink(material: Item, asset: NonNullable<Item["assets"]>[number]) {
  if (asset.asset_type === "video")
    return `/explore/watch/${material.id}?asset=${encodeURIComponent(asset.id)}`;
  if (asset.mime === "application/pdf")
    return `/explore/view/${material.id}/${asset.id}`;
  return `${asset.url}${asset.url?.includes("?") ? "&" : "?"}download=1`;
}

export default function Explore() {
  const { data, error, loading } = useData<ExploreData>("/explore");
  const location = useLocation();
  if (loading) return <Loading />;
  if (error || !data) return <Failure error={error || "The guest library could not load."} />;
  const route = location.pathname.split("/").filter(Boolean).slice(1);
  let body;
  if (route[0] === "watch" && route[1])
    body = <GuestVideo contentId={route[1]} items={data.content} />;
  else if (route[0] === "view" && route[1] && route[2])
    body = <GuestDocument contentId={route[1]} assetId={route[2]} items={data.content} />;
  else body = <GuestLibrary items={data.content} />;
  return (
    <div className="guest-explore">
      <header className="guest-header">
        <Logo />
        <div className="guest-header-note">
          <ShieldCheck size={16} /> Guest preview · No account needed
        </div>
        <nav aria-label="Guest navigation">
          <Link to="/">Home</Link>
          <Link to="/explore">Browse library</Link>
        </nav>
      </header>
      <main className="guest-main">{body}</main>
      <footer className="guest-footer">
        <span>Public preview only. No registration or learning history is created.</span>
        <Link to="/">About English Tech</Link>
      </footer>
    </div>
  );
}

function GuestLibrary({ items }: { items: Item[] }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const folderId = params.get("folder") || "";
  const current = items.find((item) => item.id === folderId);
  const subjects = items.filter((item) => item.kind === "subject");
  const containers = new Set(["subject", "folder", "chapter", "topic"]);
  const children = current
    ? items.filter((item) => item.parent_id === current.id)
    : subjects;
  const query = search.trim().toLowerCase();
  const folders = children.filter(
    (item) => containers.has(item.kind) && item.name.toLowerCase().includes(query),
  );
  const materials = children.filter(
    (item) =>
      item.kind === "video" &&
      `${item.name} ${item.description}`.toLowerCase().includes(query),
  );
  const trail = useMemo(() => {
    const path: Item[] = [];
    let node = current;
    const visited = new Set<string>();
    while (node && !visited.has(node.id)) {
      path.unshift(node);
      visited.add(node.id);
      node = items.find((item) => item.id === node?.parent_id);
    }
    return path;
  }, [current, items]);
  const openFolder = (id?: string) => setParams(id ? { folder: id } : {});

  return (
    <>
      <section className="guest-intro">
        <span className="eyebrow">WELCOME TO ENGLISH TECH</span>
        <h1>{current ? current.name : "Explore before you register."}</h1>
        <p>
          {current?.description ||
            "Browse public subjects, folders, videos, and documents without creating an account."}
        </p>
        <div className="guest-privacy-note">
          <ShieldCheck size={18} /> This guest space does not create a student profile or save progress.
        </div>
      </section>
      <nav className="guest-breadcrumbs" aria-label="Content location">
        <button type="button" onClick={() => openFolder()}>
          <Home size={15} /> Public library
        </button>
        {trail.map((item) => (
          <span key={item.id}>
            <ChevronRight size={14} />
            <button type="button" onClick={() => openFolder(item.id)}>
              {item.name}
            </button>
          </span>
        ))}
      </nav>
      <div className="guest-library-toolbar">
        <label>
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this public folder"
            aria-label="Search public content"
          />
        </label>
        <span>{folders.length + materials.length} public items</span>
      </div>

      {!current ? (
        <div className="guest-subject-grid">
          {folders.map((subject) => (
            <button key={subject.id} type="button" onClick={() => openFolder(subject.id)}>
              <CourseArt theme={subject.thumbnail} />
              <span>
                <strong>{subject.name}</strong>
                <small>{subject.description}</small>
                <b>Open subject <ArrowRight size={15} /></b>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {!!folders.length && (
            <section className="guest-content-section">
              <h2>Folders</h2>
              <div className="guest-folder-grid">
                {folders.map((folder) => (
                  <button key={folder.id} type="button" onClick={() => openFolder(folder.id)}>
                    <Folder size={24} />
                    <span>
                      <strong>{folder.name}</strong>
                      <small>{folder.description || "Open folder"}</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            </section>
          )}
          {!!materials.length && (
            <section className="guest-content-section">
              <h2>Learning materials</h2>
              <div className="guest-material-list">
                {materials.map((material) => (
                  <GuestMaterial key={material.id} material={material} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
      {!folders.length && !materials.length && (
        <Empty
          title={search ? "No public content found" : "This public folder is empty"}
          description={search ? "Try another search." : "More public previews will appear here soon."}
        >
          <BookOpen size={30} />
        </Empty>
      )}
    </>
  );
}

function GuestMaterial({ material }: { material: Item }) {
  const assets = material.assets || [];
  return (
    <article>
      <div className="guest-material-heading">
        <span><BookOpen size={20} /></span>
        <div>
          <h3>{material.name}</h3>
          <p>{material.description || "Public learning material"}</p>
        </div>
        <small>{assets.length} {assets.length === 1 ? "item" : "items"}</small>
      </div>
      {!!assets.length && (
        <div className="guest-asset-list">
          {assets.map((asset) => {
            const link = assetLink(material, asset);
            const external = !link.startsWith("/explore");
            return (
              <Link
                key={asset.id}
                to={link}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
              >
                {asset.asset_type === "video" ? <Play size={17} /> : <FileText size={17} />}
                <span>
                  <strong>{asset.filename}</strong>
                  <small>{asset.asset_type === "video" ? "Video" : "Document"} · {size(asset.size)}</small>
                </span>
                <ArrowRight size={16} />
              </Link>
            );
          })}
        </div>
      )}
    </article>
  );
}

function GuestVideo({ contentId, items }: { contentId: string; items: Item[] }) {
  const [params] = useSearchParams();
  const material = items.find((item) => item.id === contentId);
  const videos = (material?.assets || []).filter((asset) => asset.asset_type === "video");
  const selected = videos.find((asset) => asset.id === params.get("asset")) || videos[0];
  if (!material || !selected)
    return <Empty title="Video preview unavailable" description="Return to the public library and choose another item." />;
  return (
    <section className="guest-viewer-page">
      <Link className="back-link" to={`/explore?folder=${encodeURIComponent(material.parent_id || "")}`}>
        <ArrowLeft size={15} /> Back to public folder
      </Link>
      <span className="eyebrow">PUBLIC VIDEO PREVIEW</span>
      <h1>{material.name}</h1>
      <video controls controlsList="nodownload" playsInline preload="metadata" src={selected.url}>
        Your browser does not support video playback.
      </video>
      <p>{material.description}</p>
    </section>
  );
}

function GuestDocument({ contentId, assetId, items }: { contentId: string; assetId: string; items: Item[] }) {
  const material = items.find((item) => item.id === contentId);
  const asset = material?.assets?.find((entry) => entry.id === assetId);
  if (!material || !asset || asset.mime !== "application/pdf" || !asset.url)
    return <Empty title="Document preview unavailable" description="Return to the public library and choose another item." />;
  return (
    <section className="guest-viewer-page">
      <Link className="back-link" to={`/explore?folder=${encodeURIComponent(material.parent_id || "")}`}>
        <ArrowLeft size={15} /> Back to public folder
      </Link>
      <span className="eyebrow">PUBLIC DOCUMENT PREVIEW</span>
      <h1>{asset.filename}</h1>
      <p>{material.name} · {size(asset.size)}</p>
      <PdfViewer url={asset.url} filename={asset.filename} />
    </section>
  );
}
