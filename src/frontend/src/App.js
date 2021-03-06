import React, { useEffect, useRef, useState } from "react";
import { Container } from "react-bootstrap";

import gateway from "./utils/gateway";
import { getUrlParameter, sortByKey } from "./utils";

import ErrorAlert from "./components/ErrorAlert";
import Header from "./components/Header";
import MediaContent from "./components/MediaContent";
import Media from "./components/Media";
import SettingsHelp from "./components/SettingsHelp";

export default () => {
  const [tasks, setTasks] = useState([]);
  const [errorShown, showError] = useState(false);
  const tasksUpdated = useRef(false);

  const updateTasks = () => {
    tasksUpdated.current = true;
    gateway
      .getTasks()
      .then(r => setTasks(sortByKey(r.tasks, "mediaUrl")))
      .catch(() => showError(true));
  };

  const mediaUrl = getUrlParameter("watchUrl");
  const watchMode = mediaUrl !== "";

  useEffect(() => {
    if (!watchMode && !tasksUpdated.current) {
      updateTasks();
    }
  }, [tasksUpdated, watchMode]);

  return (
    <div className="App">
      <Header />
      <Container>
        <SettingsHelp show={!window.mediaAnalysisSettings} />
        <ErrorAlert show={errorShown} />
        {watchMode ? (
          <MediaContent
            getTask={() => gateway.getTask(mediaUrl)}
            poll={gateway.poll}
            mediaUrl={mediaUrl}
          />
        ) : (
          <Media
            addTask={gateway.createTask}
            deleteTask={gateway.deleteTask}
            onError={() => showError(true)}
            tasks={tasks}
            updateTasks={updateTasks}
          />
        )}
      </Container>
    </div>
  );
};
