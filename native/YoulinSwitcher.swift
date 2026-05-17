import SwiftUI
import Foundation

// MARK: - Models

struct ProviderTemplate: Identifiable {
    let id: String
    let name: String
    let baseURL: String
    let model: String
    let website: String
}

struct ThreadItem: Identifiable {
    let id: String
    let title: String
    let provider: String
    let providerName: String
    let model: String
}

let templates: [ProviderTemplate] = [
    ProviderTemplate(id: "custom", name: "自定义配置", baseURL: "", model: "", website: ""),
    ProviderTemplate(id: "openai", name: "OpenAI Official", baseURL: "https://api.openai.com/v1", model: "gpt-5.5", website: "https://platform.openai.com"),
    ProviderTemplate(id: "deepseek", name: "DeepSeek", baseURL: "http://127.0.0.1:8788/v1", model: "deepseek-v4-pro", website: "https://api-docs.deepseek.com"),
    ProviderTemplate(id: "qwen", name: "Qwen", baseURL: "http://127.0.0.1:8789/v1", model: "qwen3.6-plus", website: "https://bailian.console.aliyun.com"),
    ProviderTemplate(id: "openrouter", name: "OpenRouter", baseURL: "https://openrouter.ai/api/v1", model: "openai/gpt-5", website: "https://openrouter.ai"),
    ProviderTemplate(id: "kimi", name: "Kimi", baseURL: "https://api.moonshot.cn/v1", model: "kimi-k2-0711-preview", website: "https://platform.moonshot.cn"),
    ProviderTemplate(id: "zhipu", name: "GLM", baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4.6", website: "https://bigmodel.cn")
]

// MARK: - App Entry

@main
struct YoulinSwitcherApp: App {
    @State private var selectedTab = 0

    var body: some Scene {
        WindowGroup {
            ContentView(selectedTab: $selectedTab)
                .frame(minWidth: 1080, minHeight: 760)
        }
        .windowStyle(.titleBar)
    }
}

// MARK: - Content View

struct ContentView: View {
    @Binding var selectedTab: Int
    @State private var currentConfig = ""
    @State private var message = ""
    @State private var selectedTemplate = "custom"
    @State private var providerName = ""
    @State private var note = ""
    @State private var website = ""
    @State private var apiKey = ""
    @State private var baseURL = ""
    @State private var modelName = ""
    @State private var contextWindow = "128000"
    @State private var useCompleteURL = true
    @State private var fetchedModels = ""
    @State private var migrateMessage = ""

    var body: some View {
        HStack(spacing: 0) {
            sidebar
            Divider()
            VStack(spacing: 0) {
                // Tab selector
                HStack(spacing: 0) {
                    TabButton(title: "供应商", systemImage: "server.rack", active: selectedTab == 0) { selectedTab = 0 }
                    TabButton(title: "线程迁移", systemImage: "arrow.triangle.swap", active: selectedTab == 1) { selectedTab = 1 }
                    Spacer()
                }
                .padding(.horizontal, 28)
                .padding(.top, 12)
                .padding(.bottom, 0)
                .background(Design.bg)

                Divider()
                    .padding(.horizontal, 28)

                if selectedTab == 0 {
                    providerView
                } else {
                    MigrationView(message: $migrateMessage)
                }
            }
        }
        .background(Design.bg)
        .onAppear {
            refresh()
            applyTemplate(templates[0])
        }
    }

    var providerView: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    providerForm
                }
                .padding(28)
            }
            footer
        }
    }

    var header: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text("添加新供应商")
                    .font(.system(size: 24, weight: .semibold))
                Text("配置 Codex 主对话框使用的模型供应商")
                    .foregroundColor(.secondary)
                    .font(.system(size: 13))
            }
            Spacer()
            Button("打开 Router") {
                NSWorkspace.shared.open(URL(string: "http://127.0.0.1:8787/")!)
            }
            .buttonStyle(SoftButtonStyle())
        }
    }

    var presetStrip: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("预设供应商")
                .font(.system(size: 14, weight: .semibold))
            FlowLayout(spacing: 10) {
                ForEach(templates) { item in
                    ProviderChip(
                        title: item.name,
                        active: selectedTemplate == item.id,
                        featured: item.id != "custom" && item.id != "openai"
                    ) {
                        selectedTemplate = item.id
                        applyTemplate(item)
                    }
                }
            }
        }
    }

    var sidebar: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Design.accent)
                        .frame(width: 42, height: 42)
                    Text("Y")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(.white)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Youlin")
                        .font(.system(size: 24, weight: .bold))
                    Text("Codex Switcher")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                Label("当前配置", systemImage: "dot.radiowaves.left.and.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.secondary)
                Text(currentConfig.isEmpty ? "未读取到模型配置" : currentConfig)
                    .font(.system(size: 12, weight: .regular, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(Design.code)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .padding(14)
            .background(Design.panel)
            .clipShape(RoundedRectangle(cornerRadius: 16))

            VStack(alignment: .leading, spacing: 10) {
                Text("快速切换")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.secondary)
                SidebarAction(title: "DeepSeek V4 Pro", subtitle: "本地 8788 代理", symbol: "bolt.fill") { quickSwitch(.deepseek) }
                SidebarAction(title: "GPT-5.5", subtitle: "OpenAI 官方", symbol: "sparkles") { quickSwitch(.gpt) }
                SidebarAction(title: "Qwen 3.6 Plus", subtitle: "本地 8789 代理", symbol: "circle.hexagongrid.fill") { quickSwitch(.qwen) }
            }

            Spacer()

            VStack(alignment: .leading, spacing: 8) {
                Text("切换后需要完全退出并重新打开 Codex。")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                Button("打开 config.toml") {
                    NSWorkspace.shared.open(URL(fileURLWithPath: Paths.codexConfig))
                }
                .buttonStyle(SoftButtonStyle())
                Button("一键重启 Codex") {
                    restartCodex()
                }
                .buttonStyle(PrimaryButtonStyle())
            }
        }
        .padding(20)
        .frame(width: 300)
        .background(Design.sidebar)
    }

    var providerForm: some View {
        VStack(alignment: .leading, spacing: 22) {
            card {
                presetStrip
            }

            HStack(alignment: .center, spacing: 18) {
                ZStack {
                    RoundedRectangle(cornerRadius: 18)
                        .fill(Design.code)
                        .frame(width: 86, height: 86)
                    Text(String(providerName.prefix(1)).uppercased().isEmpty ? "P" : String(providerName.prefix(1)).uppercased())
                        .font(.system(size: 34, weight: .semibold))
                        .foregroundColor(Design.accent)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text(providerName.isEmpty ? "新供应商" : providerName)
                        .font(.system(size: 22, weight: .semibold))
                    Text(note.isEmpty ? "填写 API Key、请求地址和模型名称后，可以直接写入 Codex 配置。" : note)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }

            card {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 18) {
                        Field(title: "供应商名称", text: $providerName, placeholder: "例如：Claude 官方")
                        Field(title: "备注", text: $note, placeholder: "例如：公司专用账号")
                    }
                    Field(title: "官网链接", text: $website, placeholder: "https://example.com（可选）")
                    SecureInput(title: "API Key", text: $apiKey, placeholder: "sk-...")
                }
            }

            card {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("API 请求地址")
                            .font(.system(size: 14, weight: .semibold))
                        Spacer()
                        Toggle("完整 URL", isOn: $useCompleteURL)
                            .toggleStyle(.switch)
                    }
                    TextField("https://your-api-endpoint.com/v1", text: $baseURL)
                        .textFieldStyle(.roundedBorder)
                    Text("这里要填 Codex 可用的 Responses API 地址。本地 DeepSeek/Qwen 代理已是 8788/8789。普通 Chat Completions 接口需要先通过 mimo2codex 或同类代理转成 Responses。")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                }

                HStack(spacing: 18) {
                    Field(title: "模型名称", text: $modelName, placeholder: "gpt-5.4 / deepseek-v4-pro")
                    Field(title: "上下文窗口", text: $contextWindow, placeholder: "128000")
                }
            }

            card {
                HStack {
                    Button("获取模型列表") { fetchModels() }
                        .buttonStyle(SoftButtonStyle())
                    Button("添加并切换") { addAndSwitch() }
                        .buttonStyle(PrimaryButtonStyle())
                    Spacer()
                }

                if !fetchedModels.isEmpty {
                    Text(fetchedModels)
                        .font(.system(.caption, design: .monospaced))
                        .textSelection(.enabled)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(nsColor: .textBackgroundColor))
                        .cornerRadius(8)
                }
            }
        }
    }

    func card<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Design.panel)
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Design.stroke, lineWidth: 1))
    }

    var footer: some View {
        HStack {
            Text(message)
                .foregroundColor(message.lowercased().contains("error") ? .red : .secondary)
                .lineLimit(3)
            Spacer()
            Button("刷新状态") { refresh() }
                .buttonStyle(SoftButtonStyle())
        }
        .padding(.horizontal, 28)
        .padding(.vertical, 12)
        .background(Design.panel)
    }

    func refresh() {
        currentConfig = ConfigManager.readTopLevel()
    }

    func applyTemplate(_ template: ProviderTemplate) {
        providerName = template.name
        website = template.website
        baseURL = template.baseURL
        modelName = template.model
        if template.id == "openai" {
            note = "官方账号"
        } else if template.id == "deepseek" || template.id == "qwen" {
            note = "本地代理"
        } else {
            note = ""
        }
    }

    func quickSwitch(_ preset: ConfigManager.Preset) {
        do {
            let result = try ConfigManager.switchPreset(preset)
            message = result
            refresh()
        } catch {
            message = "Error: \(error.localizedDescription)"
        }
    }

    func restartCodex() {
        message = "正在重启 Codex..."
        DispatchQueue.global(qos: .userInitiated).async {
            let result = ConfigManager.restartCodex()
            DispatchQueue.main.async {
                message = result
            }
        }
    }

    func addAndSwitch() {
        do {
            let result = try ConfigManager.addProvider(
                providerName: providerName,
                note: note,
                website: website,
                apiKey: apiKey,
                baseURL: normalizedBaseURL(),
                modelName: modelName,
                contextWindow: Int(contextWindow.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 128000
            )
            message = result
            refresh()
        } catch {
            message = "Error: \(error.localizedDescription)"
        }
    }

    func fetchModels() {
        guard let url = URL(string: normalizedBaseURL().trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/models") else {
            fetchedModels = "Invalid URL"
            return
        }
        var req = URLRequest(url: url)
        if !apiKey.isEmpty {
            req.addValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        URLSession.shared.dataTask(with: req) { data, _, error in
            DispatchQueue.main.async {
                if let error = error {
                    fetchedModels = "Error: \(error.localizedDescription)"
                } else if let data = data, let text = String(data: data, encoding: .utf8) {
                    fetchedModels = String(text.prefix(3000))
                } else {
                    fetchedModels = "No response"
                }
            }
        }.resume()
    }

    func normalizedBaseURL() -> String {
        var value = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        while value.hasSuffix("/") { value.removeLast() }
        return value
    }
}

// MARK: - Migration View

struct MigrationView: View {
    @Binding var message: String
    @State private var threadsByProvider: [String: [ThreadItem]] = [:]
    @State private var providerList: [(id: String, name: String)] = []
    @State private var isLoading = true
    @State private var expandedProviders: Set<String> = []
    @State private var toastText = ""
    @State private var showToast = false
    @State private var toastIsError = false

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("线程迁移")
                        .font(.system(size: 24, weight: .semibold))
                    Text("将聊天记录从一个 Provider 迁移到另一个。迁移后需重启 Codex。")
                        .foregroundColor(.secondary)
                        .font(.system(size: 13))
                }
                Spacer()
                Button(action: loadThreads) {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12, weight: .semibold))
                        Text("刷新")
                    }
                }
                .buttonStyle(SoftButtonStyle())
            }
            .padding(28)

            if isLoading {
                Spacer()
                ProgressView("加载线程...")
                Spacer()
            } else if providerList.isEmpty {
                Spacer()
                Text("没有找到线程")
                    .foregroundColor(.secondary)
                Spacer()
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        ForEach(providerList, id: \.id) { provider in
                            providerSection(provider.id, provider.name)
                        }
                    }
                    .padding(.horizontal, 28)
                    .padding(.bottom, 28)
                }
            }

            // Footer
            HStack {
                if !message.isEmpty {
                    Text(message)
                        .foregroundColor(.secondary)
                        .font(.system(size: 12))
                        .lineLimit(2)
                }
                Spacer()
                Text("迁移后需重启 Codex 才能看到变化")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 12)
            .background(Design.panel)
        }
        .overlay(alignment: .bottom) {
            if showToast {
                Text(toastText)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .background(toastIsError ? Color.red.opacity(0.9) : Color.black.opacity(0.85))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .padding(.bottom, 60)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                            withAnimation { showToast = false }
                        }
                    }
            }
        }
        .onAppear { loadThreads() }
    }

    func providerSection(_ providerId: String, _ providerName: String) -> some View {
        let threads = threadsByProvider[providerId] ?? []
        let isExpanded = expandedProviders.contains(providerId)

        return VStack(alignment: .leading, spacing: 0) {
            Button(action: {
                withAnimation(.easeInOut(duration: 0.2)) {
                    if isExpanded { expandedProviders.remove(providerId) }
                    else { expandedProviders.insert(providerId) }
                }
            }) {
                HStack {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.secondary)
                        .frame(width: 16)
                    Text(providerName)
                        .font(.system(size: 14, weight: .semibold))
                    Spacer()
                    Text("\(threads.count) 条")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Design.code)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(spacing: 0) {
                    ForEach(threads) { thread in
                        ThreadRow(
                            thread: thread,
                            providerList: providerList,
                            onMigrate: { targetProvider in
                                migrateThread(thread, to: targetProvider)
                            }
                        )
                    }
                }
                .padding(.top, 4)
            }
        }
    }

    func loadThreads() {
        isLoading = true
        DispatchQueue.global(qos: .userInitiated).async {
            let result = MigrationManager.loadThreads()
            DispatchQueue.main.async {
                threadsByProvider = result.threads
                providerList = result.providers
                isLoading = false
                // Auto-expand all
                if expandedProviders.isEmpty {
                    expandedProviders = Set(result.providers.map { $0.id })
                }
            }
        }
    }

    func migrateThread(_ thread: ThreadItem, to targetProvider: String) {
        DispatchQueue.global(qos: .userInitiated).async {
            let result = MigrationManager.migrateThread(threadId: thread.id, targetProvider: targetProvider)
            DispatchQueue.main.async {
                if result.success {
                    toastText = "已迁移: \(thread.title.prefix(40))..."
                    toastIsError = false
                    message = "\(thread.provider) → \(targetProvider)"
                    loadThreads()
                } else {
                    toastText = result.error ?? "迁移失败"
                    toastIsError = true
                    message = "Error: \(result.error ?? "unknown")"
                }
                withAnimation { showToast = true }
            }
        }
    }
}

struct ThreadRow: View {
    let thread: ThreadItem
    let providerList: [(id: String, name: String)]
    let onMigrate: (String) -> Void

    @State private var selectedProvider: String
    @State private var isMigrating = false
    @State private var migrated = false

    init(thread: ThreadItem, providerList: [(id: String, name: String)], onMigrate: @escaping (String) -> Void) {
        self.thread = thread
        self.providerList = providerList
        self.onMigrate = onMigrate
        _selectedProvider = State(initialValue: thread.provider)
    }

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(thread.title)
                    .font(.system(size: 13))
                    .lineLimit(2)
                Text(thread.model)
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }

            Spacer()

            Picker("", selection: $selectedProvider) {
                ForEach(providerList, id: \.id) { p in
                    Text(p.name).tag(p.id)
                }
            }
            .labelsHidden()
            .frame(width: 140)
            .disabled(isMigrating || migrated)

            Button(action: {
                guard selectedProvider != thread.provider else {
                    return
                }
                isMigrating = true
                onMigrate(selectedProvider)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    migrated = true
                    isMigrating = false
                }
            }) {
                if isMigrating {
                    ProgressView()
                        .scaleEffect(0.7)
                        .frame(width: 60)
                } else if migrated {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold))
                        Text("Done")
                    }
                    .frame(width: 60)
                } else {
                    Text("迁移")
                        .frame(width: 60)
                }
            }
            .buttonStyle(MigrateButtonStyle(active: selectedProvider != thread.provider))
            .disabled(selectedProvider == thread.provider || isMigrating || migrated)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Design.row)
        .overlay(Rectangle().frame(height: 1).foregroundColor(Design.stroke), alignment: .bottom)
    }
}

// MARK: - Migration Manager

struct MigrationResult {
    let success: Bool
    let error: String?
}

enum MigrationManager {
    static let dbPath = "\(Paths.home)/.codex/state_5.sqlite"
    static let codexConfigPath = "\(Paths.home)/.codex/config.toml"
    static let sessionsDir = "\(Paths.home)/.codex/sessions"
    static let providerDefaultModels = [
        "openai": "gpt-5.5",
        "mimo2codex": "deepseek-v4-pro",
        "mimo2codex-qwen": "qwen3.6-plus"
    ]

    static func loadThreads() -> (providers: [(id: String, name: String)], threads: [String: [ThreadItem]]) {
        // Read provider display names from config
        var providerNames: [String: String] = ["openai": "GPT / OpenAI"]
        if let configText = try? String(contentsOfFile: codexConfigPath) {
            let lines = configText.components(separatedBy: "\n")
            var currentId: String? = nil
            for line in lines {
                if line.hasPrefix("[model_providers.") {
                    currentId = line.replacingOccurrences(of: "[model_providers.", with: "")
                        .replacingOccurrences(of: "]", with: "")
                } else if let id = currentId, line.hasPrefix("name = ") {
                    let name = line.replacingOccurrences(of: "name = ", with: "")
                        .replacingOccurrences(of: "\"", with: "")
                    providerNames[id] = name
                }
            }
        }

        let sql = #"select id, title, model_provider, model from threads order by updated_at desc limit 100;"#
        let output = shell("sqlite3", "-separator", "\t", dbPath, sql)
        var grouped: [String: [ThreadItem]] = [:]
        for line in output.components(separatedBy: "\n") {
            let parts = line.components(separatedBy: "\t")
            guard parts.count >= 4 else { continue }
            let provider = parts[2].isEmpty ? "unknown" : parts[2]
            let pname = providerNames[provider] ?? provider
            let item = ThreadItem(id: parts[0], title: parts[1], provider: provider, providerName: pname, model: parts[3])
            grouped[provider, default: []].append(item)
        }
        // Build providers list: all known
        var allIds = Set(grouped.keys)
        allIds.formUnion(Set(providerNames.keys))
        let sortedIds = allIds.sorted()
        let providers = sortedIds.map { (id: $0, name: providerNames[$0] ?? $0) }
        // Ensure all providers have an entry
        for p in sortedIds {
            if grouped[p] == nil { grouped[p] = [] }
        }
        return (providers, grouped)
    }

    static func migrateThread(threadId: String, targetProvider: String) -> MigrationResult {
        let targetModel = providerDefaultModels[targetProvider] ?? "gpt-5.5"

        // 1. Check thread exists and get current provider
        let checkSql = "select model_provider from threads where id = '\(threadId)';"
        let currentProvider = shell("sqlite3", dbPath, checkSql).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !currentProvider.isEmpty else {
            return MigrationResult(success: false, error: "Thread not found")
        }

        // 2. Update SQLite
        let now = Int(Date().timeIntervalSince1970)
        let updateSql = "update threads set model_provider = '\(targetProvider)', model = '\(targetModel)', updated_at = \(now) where id = '\(threadId)';"
        _ = shell("sqlite3", dbPath, updateSql)

        // 3. Update session JSONL
        let findOutput = shell("/bin/bash", "-c", "find '\(sessionsDir)' -name '*\(threadId)*.jsonl' 2>/dev/null | head -1")
        let sessionFile = findOutput.trimmingCharacters(in: .whitespacesAndNewlines)

        if !sessionFile.isEmpty {
            // Backup
            let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
            _ = shell("cp", sessionFile, "\(sessionFile).bak-migrate-\(stamp)")

            // Read, modify, write
            if let data = try? Data(contentsOf: URL(fileURLWithPath: sessionFile)),
               var text = String(data: data, encoding: .utf8) {
                var lines = text.components(separatedBy: .newlines)
                for i in 0..<lines.count {
                    if lines[i].contains("\"session_meta\"") {
                        if let jsonData = lines[i].data(using: .utf8),
                           var dict = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
                           var payload = dict["payload"] as? [String: Any] {
                            payload["model_provider"] = targetProvider
                            payload["model"] = targetModel
                            dict["payload"] = payload
                            if let newData = try? JSONSerialization.data(withJSONObject: dict),
                               let newLine = String(data: newData, encoding: .utf8) {
                                lines[i] = newLine
                                text = lines.joined(separator: "\n")
                                try? text.write(toFile: sessionFile, atomically: true, encoding: .utf8)
                            }
                        }
                        break
                    }
                }
            }
        }

        return MigrationResult(success: true, error: nil)
    }

    static func shell(_ args: String...) -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = args
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice
        do {
            try process.run()
            process.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            return String(data: data, encoding: .utf8) ?? ""
        } catch {
            return ""
        }
    }
}

// MARK: - Tab Button

struct TabButton: View {
    let title: String
    let systemImage: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(.system(size: 13, weight: .medium))
                Text(title)
                    .font(.system(size: 13, weight: active ? .semibold : .medium))
            }
            .foregroundColor(active ? Design.accent : .secondary)
            .padding(.horizontal, 18)
            .padding(.vertical, 10)
            .background(active ? Design.accent.opacity(0.1) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Shared Components

struct Field: View {
    let title: String
    @Binding var text: String
    let placeholder: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(size: 14, weight: .semibold))
            TextField(placeholder, text: $text)
                .textFieldStyle(.roundedBorder)
        }
    }
}

struct SecureInput: View {
    let title: String
    @Binding var text: String
    let placeholder: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(size: 14, weight: .semibold))
            SecureField(placeholder, text: $text)
                .textFieldStyle(.roundedBorder)
        }
    }
}

struct SidebarAction: View {
    let title: String
    let subtitle: String
    let symbol: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .frame(width: 28, height: 28)
                    .foregroundColor(.white)
                    .background(Design.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.primary)
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .padding(10)
            .background(Design.panel)
            .clipShape(RoundedRectangle(cornerRadius: 13))
            .overlay(RoundedRectangle(cornerRadius: 13).stroke(Design.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

struct ProviderChip: View {
    let title: String
    let active: Bool
    let featured: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 14, weight: active ? .semibold : .medium))
                if featured {
                    Image(systemName: "star.fill")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.orange)
                }
            }
            .foregroundColor(active ? .white : .primary.opacity(0.78))
            .padding(.horizontal, 16)
            .padding(.vertical, 9)
            .background(active ? Design.accent : Design.chip)
            .clipShape(RoundedRectangle(cornerRadius: 11))
        }
        .buttonStyle(.plain)
    }
}

struct MigrateButtonStyle: ButtonStyle {
    let active: Bool
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(active ? .white : .primary)
            .padding(.horizontal, 16)
            .frame(height: 34)
            .background(configuration.isPressed
                ? (active ? Design.accent.opacity(0.8) : Design.chip.opacity(0.65))
                : (active ? Design.accent : Design.chip))
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(.white)
            .padding(.horizontal, 16)
            .frame(height: 34)
            .background(configuration.isPressed ? Design.accent.opacity(0.8) : Design.accent)
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct SoftButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .medium))
            .foregroundColor(.primary)
            .padding(.horizontal, 14)
            .frame(height: 34)
            .background(configuration.isPressed ? Design.chip.opacity(0.65) : Design.chip)
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct FlowLayout<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder var content: Content

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: spacing)], alignment: .leading, spacing: spacing) {
            content
        }
    }
}

// MARK: - Design System

enum Design {
    static let bg = Color(nsColor: .windowBackgroundColor)
    static let sidebar = Color(nsColor: .underPageBackgroundColor)
    static let panel = Color(nsColor: .controlBackgroundColor)
    static let code = Color(nsColor: .textBackgroundColor)
    static let chip = Color(nsColor: .quaternaryLabelColor).opacity(0.22)
    static let row = Color(nsColor: .textBackgroundColor).opacity(0.72)
    static let stroke = Color(nsColor: .separatorColor).opacity(0.55)
    static let accent = Color(red: 0.075, green: 0.455, blue: 0.925)
}

// MARK: - Paths & Config

enum Paths {
    static let home = FileManager.default.homeDirectoryForCurrentUser.path
    static let codexConfig = "\(home)/.codex/config.toml"
    static let codexAuth = "\(home)/.codex/auth.json"
    static let routerConfig = "\(home)/.model-router/config"
    static let secrets = "\(routerConfig)/secrets.env"
    static let models = "\(routerConfig)/models.yaml"
}

enum ConfigManager {
    enum Preset {
        case deepseek
        case gpt
        case qwen
    }

    static func readTopLevel() -> String {
        guard let text = try? String(contentsOfFile: Paths.codexConfig) else { return "" }
        var lines: [String] = []
        for line in text.components(separatedBy: .newlines) {
            if line.trimmingCharacters(in: .whitespaces).hasPrefix("[") { break }
            if line.range(of: #"^\s*(model|model_provider|model_context_window|model_reasoning_effort)\s*="#, options: .regularExpression) != nil {
                lines.append(line)
            }
        }
        return lines.joined(separator: "\n")
    }

    static func switchPreset(_ preset: Preset) throws -> String {
        switch preset {
        case .deepseek:
            return try switchTop(
                label: "DeepSeek V4 Pro",
                lines: [
                    #"model = "deepseek-v4-pro""#,
                    #"model_provider = "mimo2codex""#,
                    "model_context_window = 128000",
                    #"model_reasoning_effort = "medium""#
                ],
                provider: ProviderBlock(id: "mimo2codex", name: "DeepSeek V4 Pro", baseURL: "http://127.0.0.1:8788/v1")
            )
        case .gpt:
            return try switchTop(
                label: "GPT-5.5",
                lines: [
                    #"model = "gpt-5.5""#,
                    #"model_reasoning_effort = "medium""#
                ],
                provider: nil
            )
        case .qwen:
            return try switchTop(
                label: "Qwen 3.6 Plus",
                lines: [
                    #"model = "qwen3.6-plus""#,
                    #"model_provider = "mimo2codex-qwen""#,
                    "model_context_window = 128000",
                    #"model_reasoning_effort = "medium""#
                ],
                provider: ProviderBlock(id: "mimo2codex-qwen", name: "Qwen3.6 Plus", baseURL: "http://127.0.0.1:8789/v1")
            )
        }
    }

    static func addProvider(providerName: String, note: String, website: String, apiKey: String, baseURL: String, modelName: String, contextWindow: Int) throws -> String {
        let cleanName = providerName.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanModel = modelName.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanURL = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanName.isEmpty else { throw AppError("供应商名称不能为空") }
        guard !cleanURL.isEmpty else { throw AppError("API 请求地址不能为空") }
        guard !cleanModel.isEmpty else { throw AppError("模型名称不能为空") }

        let id = "youlin-" + slug(cleanName)
        let envKey = slug(cleanName).uppercased().replacingOccurrences(of: "-", with: "_") + "_API_KEY"

        try appendModelYaml(id: id, label: cleanName, model: cleanModel, baseURL: cleanURL, envKey: envKey)
        if !apiKey.isEmpty {
            try upsertSecret(key: envKey, value: apiKey)
            try updateAuthKey(apiKey)
        }

        let result = try switchTop(
            label: cleanName,
            lines: [
                "model = \(toml(cleanModel))",
                "model_provider = \(toml(id))",
                "model_context_window = \(contextWindow)",
                #"model_reasoning_effort = "medium""#
            ],
            provider: ProviderBlock(id: id, name: cleanName, baseURL: cleanURL)
        )
        return "\(result)\n已保存供应商：\(cleanName)\nEnv：\(envKey)"
    }

    static func switchTop(label: String, lines: [String], provider: ProviderBlock?) throws -> String {
        let original = try String(contentsOfFile: Paths.codexConfig)
        let backup = "\(Paths.codexConfig).bak-\(timestamp())"
        try original.write(toFile: backup, atomically: true, encoding: .utf8)

        let all = original.components(separatedBy: .newlines)
        let firstTable = all.firstIndex { $0.trimmingCharacters(in: .whitespaces).hasPrefix("[") } ?? all.count
        let head = all[..<firstTable].filter { line in
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { return false }
            return line.range(of: #"^\s*(model|model_provider|model_context_window|model_reasoning_effort)\s*="#, options: .regularExpression) == nil
        }
        let tail = Array(all[firstTable...])
        var next = (lines + head + [""] + tail).joined(separator: "\n")
        if let provider = provider, !next.contains("[model_providers.\(provider.id)]") {
            next += "\n\n" + provider.tomlBlock()
        }
        try next.write(toFile: Paths.codexConfig, atomically: true, encoding: .utf8)
        return "Switched Codex to \(label).\nConfig: \(Paths.codexConfig)\nBackup: \(backup)\n请完全退出并重新打开 Codex。"
    }

    static func appendModelYaml(id: String, label: String, model: String, baseURL: String, envKey: String) throws {
        var text = (try? String(contentsOfFile: Paths.models)) ?? "models:\n"
        if text.contains("\n  \(id):") { return }
        if !text.hasSuffix("\n") { text += "\n" }
        text += """
          \(id):
            label: \(yaml(label))
            provider: openai-compatible
            model: \(yaml(model))
            base_url: \(yaml(baseURL))
            api_key_env: \(yaml(envKey))

        """
        try text.write(toFile: Paths.models, atomically: true, encoding: .utf8)
    }

    static func upsertSecret(key: String, value: String) throws {
        try FileManager.default.createDirectory(atPath: Paths.routerConfig, withIntermediateDirectories: true)
        let old = (try? String(contentsOfFile: Paths.secrets)) ?? ""
        var lines = old.components(separatedBy: .newlines).filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        var found = false
        lines = lines.map {
            if $0.hasPrefix("\(key)=") {
                found = true
                return "\(key)=\(value)"
            }
            return $0
        }
        if !found { lines.append("\(key)=\(value)") }
        try (lines.joined(separator: "\n") + "\n").write(toFile: Paths.secrets, atomically: true, encoding: .utf8)
    }

    static func updateAuthKey(_ apiKey: String) throws {
        let old = (try? Data(contentsOf: URL(fileURLWithPath: Paths.codexAuth))) ?? Data("{}".utf8)
        let object = (try? JSONSerialization.jsonObject(with: old)) as? [String: Any] ?? [:]
        var next = object
        next["OPENAI_API_KEY"] = apiKey
        let backup = "\(Paths.codexAuth).bak-\(timestamp())"
        try old.write(to: URL(fileURLWithPath: backup))
        let data = try JSONSerialization.data(withJSONObject: next, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: URL(fileURLWithPath: Paths.codexAuth))
    }

    static func restartCodex() -> String {
        let script = """
        (/usr/bin/osascript -e 'tell application "Codex" to quit' >/dev/null 2>&1; sleep 1; /usr/bin/open -a Codex >/dev/null 2>&1) &
        """
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/bash")
        process.arguments = ["-lc", script]
        do {
            try process.run()
            return "已发送重启 Codex 指令。"
        } catch {
            return "Error: \(error.localizedDescription)"
        }
    }

    static func slug(_ value: String) -> String {
        let lower = value.lowercased()
        let allowed = lower.map { ch -> Character in
            if ch.isLetter || ch.isNumber { return ch }
            return "-"
        }
        return String(allowed).split(separator: "-").joined(separator: "-")
    }

    static func timestamp() -> String {
        ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
    }

    static func toml(_ value: String) -> String {
        String(data: try! JSONSerialization.data(withJSONObject: [value]), encoding: .utf8)!
            .dropFirst()
            .dropLast()
            .description
    }

    static func yaml(_ value: String) -> String { toml(value) }
}

struct ProviderBlock {
    let id: String
    let name: String
    let baseURL: String

    func tomlBlock() -> String {
        """
        [model_providers.\(id)]
        name = \(ConfigManager.toml(name))
        base_url = \(ConfigManager.toml(baseURL))
        wire_api = "responses"
        requires_openai_auth = true
        request_max_retries = 1
        """
    }
}

struct AppError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}
